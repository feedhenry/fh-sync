var mongodbQ = require('mongodb-queue');
var metrics = require('./sync-metrics');
var _ = require('underscore');
var syncUtil = require('./util');
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;
var parseDuration = require('parse-duration');
var async = require('async');

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
 * @param {Object} opts configuration options for the queue
 * @param {Object} opts.mongodb an instance of the mongodb connection. This is required.
 * @param {Number} opts.visibility see https://github.com/chilts/mongodb-queue#visibility---message-visibility-window
 * @param {Object} opts.queueMessagesTTL The TTL (time to live) value for the messages on the queue. Default to 24 hours.
 */
function MongodbQueue(name, metrics, opts) {
  if (!name) {
    throw new Error('name is required to create a mongodb queue');
  }
  if (!opts || !opts.mongodb) {
    throw new Error('mongodb is not specified to create mongodb queue');
  }
  this.queueName = name;
  this.metrics = metrics;
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
  if (!self.queue) {
    self.queue = mongodbQ(self.mongodb, self.queueName, self.queueOptions);
    var collection = self.mongodb.collection(self.queueName);
    async.series([
      function createIndexes(callback) {
        self.queue.createIndexes(callback);
      },
      //it's not allowed to add TTL index if there is an existing index on the field, so we drop it first.
      //it also makes it easier to update the TTL value. Otherwise we will have to check the existence of the index and call a different command to update the index.
      function dropDeletedIndexIfExists(callback) {
        var indexName = 'deleted_1';
        collection.indexExists(indexName, function(err, exists){
          if (err) {
            return callback(err);
          }
          if (exists) {
            collection.dropIndex(indexName, callback);
          } else {
            return callback();
          }
        })
      },
      function addTTLIndex(callback) {
        collection.createIndex({'deleted': 1}, {'expireAfterSeconds': self.queueTTL, 'background': true}, callback);
      }
    ], function(err){
       if (err) {
        return cb(err);
      }
      return cb(null, self.queue);
    });
  } else {
    return cb(null, self.queue);
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