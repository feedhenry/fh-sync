var fhComponentMetrics = require('fh-component-metrics');
var Timer = function(){
  this.start = new Date().getTime();
};

Timer.prototype.stop = function(){
  var end = new Date().getTime();
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
    QUEUE_OPERATION_TIME: "queue-operation-time"
  },
  startTimer: function() {
    return new Timer();
  }
};