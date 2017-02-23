var fhComponentMetrics = require('fh-component-metrics');
var syncUtils = require('./util');
var metricsClient = fhComponentMetrics({enabled: false});

var Timer = function(){
  this.start = Date.now();
};

Timer.prototype.stop = function(){
  var end = Date.now();
  return end - this.start;
};

var timeAsyncFunc = function(metricKey, targetFn) {
  return function() {
    var args = [].slice.call(arguments);
    if (typeof args[args.length - 1] !== 'function') {
      syncUtils.doLog(syncUtils.SYNC_LOGGER, 'info', 'can not time the target function ' + targetFn.name + ' as last argument is not a function');
    } else {
      var callback = args.pop();
      var timer = new Timer();
      args.push(function(){
        var timing = timer.stop();
        metricsClient.gauge(metricKey, {success: !arguments[0], fn: targetFn.name}, timing);
        return callback.apply(null, arguments);
      });
    }
    targetFn.apply(null, args);
  }
}

module.exports = {
  init: function(metricsConf) {
    metricsClient = fhComponentMetrics(metricsConf || {enabled: false});
    return metricsClient;
  },
  KEYS: {
    WORKER_JOB_ERROR_COUNT: "worker-get-job-error-count",
    WORKER_JOB_TOTAL_COUNT: "worker-job-count",
    WORKER_JOB_FAILURE_COUNT: "worker-job-failure-count",
    WORKER_JOB_SUCCESS_COUNT: "worker-job-success-count",
    WORKER_JOB_PROCESS_TIME: "worker-job-process-time",
    QUEUE_OPERATION_TIME: "queue-operation-time",
    HANDLER_OPERATION_TIME: "sync-handler-operation-time",
    SYNC_SCHEDULER_CHECK_TIME: "sync-scheduler-check-time",
    SYNC_REQUEST_TOTAL_PROCESS_TIME: "sync-request-total-process-time",
    PENDING_CHANGE_PROCESS_TIME: "pending-change-process-time",
    SYNC_API_PROCESS_TIME: "sync-api-process-time"
  },
  startTimer: function() {
    return new Timer();
  },
  timeAsyncFunc: timeAsyncFunc
};