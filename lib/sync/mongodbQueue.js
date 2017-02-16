var mongodbQ = require('mongodb-queue');

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
 * @param {Object} opts configuration options for the queue
 * @param {Object} opts.mongodb an instance of the mongodb connection. This is required.
 * @param {Number} opts.visibility see https://github.com/chilts/mongodb-queue#visibility---message-visibility-window
 */
function MongodbQueue(name, opts) {
  if (!name) {
    throw new Error('name is required to create a mongodb queue');
  }
  if (!opts || !opts.mongodb) {
    throw new Error('mongodb is not specified to create mongodb queue');
  }
  this.queueName = name;
  this.mongodb = opts.mongodb;
  this.queueOptions = { visibility: opts.visibility || 30 };
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
  }
  return cb(null, self.queue);
};

/**
 * See https://github.com/chilts/mongodb-queue for details about those methods.
 * We may not need all those methods, we can review them and remove the ones that we don't need.
 */
['add', 'get', 'ack', 'ping', 'total', 'size', 'inFlight', 'done', 'clean'].forEach(function(methodName){
  MongodbQueue.prototype[methodName] = function() {
    var self = this;
    ensureQueueCreated(self);
    self.queue[methodName].apply(self.queue, arguments);
  };
});

module.exports = MongodbQueue;