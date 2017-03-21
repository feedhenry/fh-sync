var fhComponentMetrics = require('fh-component-metrics');
var util = require('util');
var syncUtils = require('./util');
var metricsClient = fhComponentMetrics({enabled: false});
var _ = require('underscore');
var async = require('async');

var METRIC_KEYS = {
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
  SYNC_API_PROCESS_TIME: "sync-api-process-time",
  MONGODB_OPERATION_TIME: "mongodb-operation-time",
  WORKER_QUEUE_SIZE: "worker-queue-size"
};

var statsNamespace = 'fhsyncstats';
var metricsTitle = (process.env.FH_TITLE || 'fhsync') + '_stats';

var redisClient;

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
      syncUtils.doLog(syncUtils.SYNC_LOGGER, 'debug', 'can not time the target function ' + targetFn.name + ' as last argument is not a function');
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
};

/**
 * Compute the max, min, current, average values from the records
 * @param {Object} metric some meta data about the metric
 * @param {Array} records
 */
var aggregateData = function(metric, records) {
  var returnValue = {message: 'no stats available', name: metric.displayName};
  if (records && records.length > 0) {
    returnValue = _.chain(records).map(function(recordStr){
      return JSON.parse(recordStr);
    }).groupBy(function(record){
      return record.tags[metric.groupByTag];
    }).reduce(function(reduced, groupRecords, groupKey){
      var processedData = _.reduce(groupRecords, function(memo, groupRecord){
        var value = groupRecord.fields[metric.valueField];
        memo.current = value;
        memo.numberOfRecords++;
        memo.total+=value;
        memo.max = Math.max(value, memo.max);
        memo.min = Math.min(value, memo.min);
        memo.from = Math.min(groupRecord.ts, memo.from);
        memo.end = Math.max(groupRecord.ts, memo.end);
        return memo;
      }, {max: 0, min:Number.MAX_SAFE_INTEGER, current: 0, numberOfRecords: 0, total: 0, from: Number.MAX_SAFE_INTEGER, end: 0});
      reduced[groupKey] = {
        current: processedData.current,
        max: processedData.max,
        min: processedData.min,
        average:  Math.floor(processedData.total/processedData.numberOfRecords),
        numberOfRecords: processedData.numberOfRecords,
        from: new Date(processedData.from).toISOString(),
        end: new Date(processedData.end).toISOString()
      };
      return reduced;
    }, {}).value();
  }
  return returnValue;
};

var getStats = function(cb) {
  var metricsToFetch = [{
    metricName: metricsTitle + '_cpu',
    displayName: "CPU usage (%)",
    groupByTag: 'workerId',
    valueField: 'cpuUsed'
  }, {
    metricName: metricsTitle + '_memory',
    displayName: 'RSS Memory Usage (byte)',
    groupByTag: 'workerId',
    valueField: 'rss'
  }, {
    metricName: METRIC_KEYS.WORKER_JOB_PROCESS_TIME,
    displayName: 'Job Process Time (ms)',
    groupByTag: 'name',
    valueField: 'value'
  }, {
    metricName: METRIC_KEYS.WORKER_QUEUE_SIZE,
    displayName: 'Job Queue Size',
    groupByTag: 'name',
    valueField: 'value'
  }, {
    metricName: METRIC_KEYS.SYNC_API_PROCESS_TIME,
    displayName: 'API Process Time (ms)',
    groupByTag: 'fn',
    valueField: 'value'
  }, {
    metricName: METRIC_KEYS.MONGODB_OPERATION_TIME,
    displayName: 'Mongodb Operation Time (ms)',
    groupByTag: 'fn',
    valueField: 'value'
  }];
  async.map(metricsToFetch, function(metric, callback) {
    var metricName = metric.metricName;
    redisClient.lrange([statsNamespace, metricName].join(':'), 0, Number.MAX_SAFE_INTEGER, function(err, data){
      if (err) {
        syncUtils.doLog(SYNC_LOGGER, 'error', 'Failed to get values from redis for key ' + metricName + ' with error : ' + util.inspect(err));
        return callback();
      }
      var stats = aggregateData(metric, data);
      stats.name = metric.displayName;
      return callback(null, stats)
    });
  }, function(err, results){
    if (err) {
      return cb(err);
    }
    var reduced = _.reduce(results, function(sofar, result){
      sofar[result.name] = result;
      delete result.name;
      return sofar;
    }, {});
    return cb(null, reduced);
  });
};

module.exports = {
  init: function(syncConfig, redisClientImpl) {
    var metricsConfig = {enabled: false};
    if (syncConfig.collectStats && redisClientImpl) {
      redisClient = redisClientImpl;
      metricsConfig.enabled = true;
      metricsConfig.backends = metricsConfig.backends || [];
      metricsConfig.backends.push({
        type: 'redis',
        redisClient: redisClientImpl,
        namespace: statsNamespace,
        recordsToKeep: syncConfig.statsRecordsToKeep
      });
    }
    if (syncConfig.metricsInfluxdbHost && syncConfig.metricsInfluxdbPort) {
      metricsConfig.enabled = true;
      metricsConfig.backends = metricsConfig.backends || [];
      metricsConfig.backends.push({
        type: 'influxdb',
        host: syncConfig.metricsInfluxdbHost,
        port: syncConfig.metricsInfluxdbPort
      });
    }
    metricsClient = fhComponentMetrics(metricsConfig);
    if (metricsConfig.enabled && metricsConfig.backends && metricsConfig.backends.length) {
      var collectInterval = syncConfig.collectStatsInterval || 5000;
      metricsClient.cpu(metricsTitle, {interval: collectInterval}, _.noop);
      metricsClient.memory(metricsTitle, {interval: collectInterval}, _.noop);
    }
    return metricsClient;
  },
  KEYS: METRIC_KEYS,
  startTimer: function() {
    return new Timer();
  },
  timeAsyncFunc: timeAsyncFunc,
  getStats: getStats
};
