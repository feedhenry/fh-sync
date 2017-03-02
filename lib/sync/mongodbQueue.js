var mongodbQ = require('mongodb-queue');
var metrics = require('./sync-metrics');
var _ = require('underscore');

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
  this.queueOptions = { visibility: opts.visibility || 30 };
  this.queueAddConcurrency = opts.addConcurrency || 5;
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
    self.queue.createIndexes(function(err){
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
['add', 'get', 'ack', 'ping', 'total', 'size', 'inFlight', 'done', 'clean'].forEach(function(methodName){
  MongodbQueue.prototype[methodName] = function() {
    var self = this;
    ensureQueueCreated(self);
    var args = [].slice.call(arguments);
    var callback = args.pop();
    if (typeof callback !== 'function') {
      throw new Error("no callback function found for queue." + methodName);
    }
    var timer = metrics.startTimer();
    args.push(function(){
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
    return cb(new Error('Message list length must be greater than 0'));
  }
  var self = this;
  return self.add(messages, cb); //it supports an array of messages since v2.2.0
};

//TODO: add this to the mongodb-queue module
MongodbQueue.prototype.search = function(searchFields, cb) {
  var self = this;
  var collection = self.mongodb.collection(self.queueName);
  var query = {
    deleted : null,
    payload: searchFields
  };
  collection.find(query).toArray(function(err, docs){
    if (err) {
      return cb(err);
    }
    return cb(null, _.pluck(docs, 'payload'));
  });
};

module.exports = MongodbQueue;