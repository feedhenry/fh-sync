var util = require('util');
var syncUtil = require('./util');
var LOGGER_NAME = syncUtil.SYNC_LOGGER;

/**
 * @function QueueWorker~processor
 * @param {Object} job the job from the queue.
 * @param {String} job.id the mongodb id of the job
 * @param {String} job.ack a unique id of the message in order to ack
 * @param {Object} job.payload the payload of the message
 * @param {Number} job.tries the number of tries of the job
 * @param {Function} callback the callback function that should be invoked when the job is completed
 */

/**
 * construct a new worker that will consume the jobs from the given queue and process it with the given processor.
 * @param {MongodbQueue} queue an instance of the MongodbQueue
 * @param {QueueWorker~processor} the job processor
 * @param {Object} opts configuration options
 * @param {Number} opts.interval the interval between job runs
 */
function QueueWorker(queue, processor, opts) {
  this.queue = queue;
  this.processor = processor;
  this.opts = opts || {};
  this.interval = this.opts.interval || 1000;
}

function next(worker) {
  setTimeout(function(){
    worker.work();
  }, worker.interval);
}

/**
 * Start process the jobs from the queue with the processor
 */
QueueWorker.prototype.work = function() {
  var self = this;
  self.queue.get(function(err, job){
    if (err) {
      syncUtil.doLog(LOGGER_NAME, 'error', 'Error occured when try to get the job from the queue. Error = ' + util.inspect(err));
      return next(self);
    }

    if (job) {
      self.processor(job, function(err){
        if (err) {
          syncUtil.doLog(LOGGER_NAME, 'error', 'Error occured processing job. Job = ' + util.inspect(job)  + ' Error = ' + util.inspect(err));
        }
        return next(self);
      });
    } else {
      return next(self);
    }
  });
};

module.exports = QueueWorker;