var syncUtil = require('./util');
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;
var metrics = require('./sync-metrics');
var backoff = require('backoff');

function initBackoff(backOffOpts) {
  var bo;
  if (backOffOpts.strategy && backOffOpts.strategy.toLowerCase() === 'exp') {
    bo = new backoff.ExponentialStrategy({initialDelay: backOffOpts.min, maxDelay: backOffOpts.max});
  } else if (backOffOpts.strategy &&  backOffOpts.strategy.toLowerCase() === 'fib') {
    bo = new backoff.FibonacciStrategy({initialDelay: backOffOpts.min, maxDelay: backOffOpts.max});
  } else {
    //if no valid value is given, just return the default minimum delay. Can be used to turn off backoff.
    console.log('[info] no valid sync strategy found in the backoff options. Turning off backoff', backOffOpts);
    bo = {
      next: function() {
        return backOffOpts.min;
      },
      reset: function() {

      }
    };
  }
  return bo;
}

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
 * @param {Object} metrics an instance of fh-component-metrics to collect metrics data
 * @param {Object} opts configuration options
 * @param {Number} opts.interval the interval between job runs
 */
function QueueWorker(queue, processor, metrics, opts) {
  this.queue = queue;
  this.processor = processor;
  this.metrics = metrics;
  this.opts = opts || {};
  this.interval = this.opts.interval || 1000;
  this.collectStatsInterval = this.opts.collectStatsInterval || 1000;
  this.name = this.opts.name || 'noname';
  var backoffConf = this.opts.backoff || {strategy: 'exp', max: 60*1000};
  backoffConf.min = this.interval; //always use the interval value as the minimum delay
  this.backoff = initBackoff(backoffConf);
  this.stopped = false;
  this.collectStats();
}

function next(worker) {
  setTimeout(function() {
    if (!worker.stopped) {
      worker.work();
    }
  }, worker.backoff.next());
}

/**
 * Start process the jobs from the queue with the processor
 */
QueueWorker.prototype.work = function() {
  var self = this;
  debug('[worker %s] find next job to work at %s', self.name, Date.now());
  self.queue.get(function(err, job) {
    if (err) {
      self.metrics.inc(metrics.KEYS.WORKER_JOB_ERROR_COUNT, {name: self.name});
      debugError('Error occured when try to get the job from the queue. Error = %s', err);
      return next(self);
    }
    if (job) {
      self.backoff.reset();
      debug('Found job to process = %j', job);
      self.metrics.inc(metrics.KEYS.WORKER_JOB_TOTAL_COUNT, {name: self.name});
      var timer = metrics.startTimer();
      self.processor(job, function(err) {
        var timing = timer.stop();
        self.metrics.gauge(metrics.KEYS.WORKER_JOB_PROCESS_TIME, {name: self.name}, timing);
        if (err) {
          self.metrics.inc(metrics.KEYS.WORKER_JOB_FAILURE_COUNT, {name: self.name});
          //if the processor reports an error, we will not delete the job (ack it).
          //This will allow the processor to get the job again and decide if the job should be retried (using the `tries` value).
          //If the processor doesn't allow retry, it can call `done` with no error, and that will remove the job.
          //Otherwise the processor can try it again.
          debugError('Error occured processing job. Job = %j Error = %s', job, err);
          return next(self);
        } else {
          self.metrics.inc(metrics.KEYS.WORKER_JOB_SUCCESS_COUNT, {name: self.name});
          self.queue.ack(job.ack, function(err) {
            if (err) {
              debugError('Error occured acking job. Job = %j Error = %s', job, err);
            }
            return next(self);
          });
        }
      });
    } else {
      debug('no job to process');
      return next(self);
    }
  });
};

/**
 * Stop the queue worker
 */
QueueWorker.prototype.stop = function(cb) {
  this.backoff.reset();
  this.stopped = true;
  return cb && cb();
};

/**
 * Monitor the queue size and report it as a metric.
 */
QueueWorker.prototype.collectStats = function() {
  var self = this;
  if (!self.statsCollector) {
    self.statsCollector = setInterval(function(){
      self.queue.size(function(err, size) {
        if (err) {
          debugError('Error occured when try to get queue size. Error = %s', err);
          return;
        }
        self.metrics.gauge(metrics.KEYS.WORKER_QUEUE_SIZE, {name: self.name}, size);
      });
    }, self.collectStatsInterval);
  }
};

module.exports = QueueWorker;
