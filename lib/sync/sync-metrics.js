var fhComponentMetrics = require('fh-component-metrics');
var Timer = function(){
  this.start = Date.now();
};

Timer.prototype.stop = function(){
  var end = Date.now();
  return end - this.start;
};

module.exports = {
  init: function(metricsConf) {
    return fhComponentMetrics(metricsConf || {enabled: false});
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
    SYNC_REQUEST_TOTAL_PROCESS_TIME: "sync-request-total-process-time"
  },
  startTimer: function() {
    return new Timer();
  }
};