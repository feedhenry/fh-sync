var mongodbQ = require('mongodb-queue');
var metrics = require('./sync-metrics');
var _ = require('underscore');
var syncUtil = require('./util');
var debug = syncUtil.debug;
var parseDuration = require('parse-duration');

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
 * @param {Object} opts.messagesToKeep decide what messages should be kept on the queue after acknowledged. This could be useful as an audit log. Default: {time: '24h'}. Means only the messages in the last 24 hours will be kept.
 * @param {Number} opts.pruneFrequency decide how often the prune job should be runnning (in milliseconds). Default to every hour.
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
  this.messagesToKeep = opts.messagesToKeep || {time: '24h'};
  this.pruneFrequency = opts.pruneFrequency || 1 * 60 * 60 * 1000;
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
    self.queue.createIndexes(function(err) {
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

/**
 * Prune the queue to remove some of the completed messages from the queue.
 */
MongodbQueue.prototype.prune = function(cb) {
  var self = this;
  var pruneQuery = {
    deleted: {$exists: true}
  }
  var collection = self.mongodb.collection(self.queueName);
  if (self.messagesToKeep && self.messagesToKeep.time) {
    var since = new Date(Date.now() - parseDuration(self.messagesToKeep.time));
    pruneQuery.visible = {$lt: since.toISOString()};
  }
  var timer = metrics.startTimer();
  collection.deleteMany(pruneQuery, function(err, result){
    self.metrics.gauge(metrics.KEYS.QUEUE_OPERATION_TIME, {method: 'prune', name: self.queueName}, timer.stop());
    if (err) {
      debug('Failed to delete messages from queue %s due to error %j', self.queueName, err);
    } else {
      debug('Deleted %d messages from queue %s', result.deletedCount, self.queueName);
    }
    return cb && cb(err, result);
  });
};

/**
 * Set an interval to prune the queue.
 */
MongodbQueue.prototype.startPruneJob = function(immediately, cb) {
  var self = this;
  if (immediately) {
    self.prune();
  }
  if (!self.pruneJob) {
    self.pruneJob = setInterval(function() {
      self.prune();
    }, self.pruneFrequency);
  }
  return cb && cb();
};

MongodbQueue.prototype.stopPruneJob = function() {
  var self = this;
  if (self.pruneJob) {
    clearInterval(self.pruneJob);
  }
};

module.exports = MongodbQueue;