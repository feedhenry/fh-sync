var mongodbQ = require('mongodb-queue');
var metrics = require('./sync-metrics');
var _ = require('underscore');
var async = require('async');
var syncUtil = require('./util');
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;

/**
 * Make sure the real queue is created. Otherwise throws an error.
 */
function ensureQueueCreated(target) {
  if (!target.queue) {
    throw new Error('queue ' + target.queueName + ' is not created yet. Please call queue.create first');
  }
}

/**
 * construct a new queue that is backed by mongodb.
 * @param {String} name the name of the queue.
 * @param {Object} metrics an instance of fh-component-metrics client
 * @param {Object} lock an instance of the lock service
 * @param {Object} opts configuration options for the queue
 * @param {Object} opts.mongodb an instance of the mongodb connection. This is required.
 * @param {Number} opts.visibility see https://github.com/chilts/mongodb-queue#visibility---message-visibility-window
 * @param {Object} opts.queueMessagesTTL The TTL (time to live) value for the messages on the queue. Default to 24 hours.
 */
function MongodbQueue(name, metrics, lock, opts) {
  if (!name) {
    throw new Error('name is required to create a mongodb queue');
  }
  if (!opts || !opts.mongodb) {
    throw new Error('mongodb is not specified to create mongodb queue');
  }
  this.queueName = name;
  this.metrics = metrics;
  this.lock = lock;
  this.lockName = opts.lockName || ('lock:sync:' + this.queueName);
  this.lockTimeout = opts.lockTimeout || 10000;
  this.mongodb = opts.mongodb;
  this.queueOptions = {visibility: opts.visibility || 30};
  this.queueTTL = opts.queueMessagesTTL || 24*60*60;
  this.queue;
}

/**
 * @function MongodbQueue~createCallback
 * @param {Error} err An error occured when trying to create queue
 * @param {Object} queue The queue instance that is created
 */

/**
 * create the queue.
 * @param {MongodbQueue~createCallback} cb the callback function
 */
MongodbQueue.prototype.create = function(cb) {
  var self = this;
  if (self.queue) {
    return cb(null, self.queue);
  } else {
    self.queue = mongodbQ(self.mongodb, self.queueName, self.queueOptions);
    var collection = self.mongodb.collection(self.queueName);
    var indexName = 'deleted_1';
    self.lock.acquire(self.lockName, self.lockTimeout, function(err, lockCode){
      if (err) {
        debugError('[%s] failed to acquire lock %s due to error : %s', self.queueName, self.lockName, err);
        return cb(err);
      }
      if (!lockCode) {
        debug('[%s] can not acquire lock. Skip creating queuing index.', self.queueName, self.lockName);
        return cb(null, self.queue);
      } else {
        debug('[%s] lock %s acquired. Continue.', self.queueName, self.lockName);
        async.waterfall([
          function createIndexes(callback) {
            debug('[%s] creating queue indexes', self.queueName);
            self.queue.createIndexes(callback);
          },
          function addExtraIdIndex(createdIndex, callback) {
            debug('[%s] adding extra _id index for queue', self.queueName);
            collection.createIndex({ deleted : 1, visible : 1, _id : 1}, callback);
          },
          function addExtraAckIndex(createdIndex, callback) {
            debug('[%s] adding extra ack index for queue', self.queueName);
            collection.createIndex({ ack: 1, visible : 1, deleted : 1}, callback);
          },
          function listIndexes(createdIndex, callback) {
            debug('[%s] list existing indexes', self.queueName);
            collection.indexInformation({full: true}, callback);
          },
          function checkIndexTTL(indexInfo, callback) {
            debug('[%s] found queue indexInfo : %j', self.queueName, indexInfo);
            var existingIndex = _.findWhere(indexInfo, {name: indexName});
            var needDrop = false;
            var needCreate = false;

            if (!existingIndex) {
              needCreate = true;
            } else if (existingIndex.expireAfterSeconds !== self.queueTTL) {
              needDrop = true;
              needCreate = true;
            }
            return callback(null, needDrop, needCreate);
          },
          function dropTTLIndex(needDrop, needCreate, callback) {
            if (needDrop) {
              debug('[%s] dropping ttl index: %s', self.queueName, indexName);
              collection.dropIndex(indexName, function(err){
                return callback(err, needCreate);
              });
            } else {
              debug('[%s] skip dropping ttl index', self.queueName);
              return callback(null, needCreate);
            }
          },
          function createTTLIndex(needCreate, callback) {
            if (needCreate) {
              debug('[%s] creating ttl index: %s', self.queueName, indexName);
              collection.createIndex({'deleted': 1}, {'expireAfterSeconds': self.queueTTL, 'background': true}, callback);
            } else {
              debug('[%s] skip creating ttl index', self.queueName);
              return callback();
            }
          }
        ], function(err){
          if (err) {
            debugError('[%s] failed to create queue index due to error: %s', self.queueName, err);
            return cb(err);
          }
          self.lock.release(self.lockName, lockCode, function(releaseErr){
            if (releaseErr) {
              debugError('[%s] failed to release lock due to error: %s', self.queueName, releaseErr);
            }
          });
          return cb(null, self.queue);
        });
      }
    });
  }
};

/**
 * See https://github.com/chilts/mongodb-queue for details about those methods.
 * We may not need all those methods, we can review them and remove the ones that we don't need.
 */
['add', 'get', 'ack', 'ping', 'total', 'size', 'inFlight', 'done', 'clean'].forEach(function(methodName) {
  MongodbQueue.prototype[methodName] = function() {
    var self = this;
    ensureQueueCreated(self);
    var args = [].slice.call(arguments);
    var callback = args.pop();
    if (typeof callback !== 'function') {
      throw new Error("no callback function found for queue." + methodName);
    }
    var timer = metrics.startTimer();
    args.push(function() {
      var timing = timer.stop();
      self.metrics.gauge(metrics.KEYS.QUEUE_OPERATION_TIME, {method: methodName, name: self.queueName}, timing);
      return callback.apply(null, arguments);
    });
    self.queue[methodName].apply(self.queue, args);
  };
});

MongodbQueue.prototype.getName = function() {
  return this.queueName;
};

MongodbQueue.prototype.addMany = function(messages, cb) {
  if (messages.length === 0) {
    return cb();
  }
  var self = this;
  return self.add(messages, cb); //it supports an array of messages since v2.2.0
};

//TODO: add this to the mongodb-queue module
MongodbQueue.prototype.search = function(searchFields, cb) {
  var self = this;
  var collection = self.mongodb.collection(self.queueName);
  var query = {
    deleted: {$exists: false},
    payload: searchFields
  };
  var timer = metrics.startTimer();
  collection.find(query).toArray(function(err, docs){
    self.metrics.gauge(metrics.KEYS.QUEUE_OPERATION_TIME, {method: 'search', name: self.queueName}, timer.stop());
    if (err) {
      return cb(err);
    }
    return cb(null, _.pluck(docs, 'payload'));
  });
};

module.exports = MongodbQueue;