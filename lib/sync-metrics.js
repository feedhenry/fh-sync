var fhComponentMetrics = require('fh-component-metrics');
var syncUtils = require('./util');
var metricsClient = fhComponentMetrics({enabled: false});
var _ = require('underscore');
var async = require('async');

var MB = 1024*1024;

var metricsTitle = (process.env.FH_TITLE || 'fhsync') + '_stats';
var METRIC_KEYS = {
  WORKER_JOB_ERROR_COUNT: metricsTitle + "_worker-get-job-error-count",
  WORKER_JOB_TOTAL_COUNT: metricsTitle + "_worker-job-count",
  WORKER_JOB_FAILURE_COUNT: metricsTitle + "_worker-job-failure-count",
  WORKER_JOB_SUCCESS_COUNT: metricsTitle + "_worker-job-success-count",
  WORKER_JOB_PROCESS_TIME: metricsTitle + "_worker-job-process-time",
  QUEUE_OPERATION_TIME: metricsTitle + "_queue-operation-time",
  HANDLER_OPERATION_TIME: metricsTitle + "_sync-handler-operation-time",
  SYNC_SCHEDULER_CHECK_TIME: metricsTitle + "_sync-scheduler-check-time",
  SYNC_REQUEST_TOTAL_PROCESS_TIME: metricsTitle + "_sync-request-total-process-time",
  PENDING_CHANGE_PROCESS_TIME: metricsTitle + "_pending-change-process-time",
  SYNC_API_PROCESS_TIME: metricsTitle + "_sync-api-process-time",
  MONGODB_OPERATION_TIME: metricsTitle + "_mongodb-operation-time",
  WORKER_QUEUE_SIZE: metricsTitle + "_worker-queue-size"
};

var MAX_NUMBER = Number.MAX_SAFE_INTEGER || Number.MAX_VALUE;

var statsNamespace = 'fhsyncstats';

var redisClient;
var debugError = syncUtils.debugError;

var Timer = function() {
  this.start = Date.now();
};

Timer.prototype.stop = function() {
  var end = Date.now();
  return end - this.start;
};

var timeAsyncFunc = function(metricKey, targetFn) {
  return function() {
    var args = [].slice.call(arguments);
    if (typeof args[args.length - 1] !== 'function') {
      debugError('can not time the target function %s as last argument is not a function', targetFn.name);
    } else {
      var callback = args.pop();
      var timer = new Timer();
      args.push(function() {
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
    returnValue = _.chain(records).map(function(recordStr) {
      return JSON.parse(recordStr);
    }).groupBy(function(record) {
      return record.tags[metric.groupByTag];
    }).reduce(function(reduced, groupRecords, groupKey) {
      groupRecords = _.sortBy(groupRecords, 'ts');
      var processedData = _.reduce(groupRecords, function(memo, groupRecord) {
        var value = groupRecord.fields[metric.valueField];
        memo.current = value;
        memo.numberOfRecords++;
        memo.total += value;
        memo.max = Math.max(value, memo.max);
        memo.min = Math.min(value, memo.min);
        memo.from = Math.min(groupRecord.ts, memo.from);
        memo.end = Math.max(groupRecord.ts, memo.end);
        return memo;
      }, {max: 0, min: MAX_NUMBER, current: 0, numberOfRecords: 0, total: 0, from: MAX_NUMBER, end: 0});
      reduced[groupKey] = {
        current: metric.dataFormatter(processedData.current),
        max: metric.dataFormatter(processedData.max),
        min: metric.dataFormatter(processedData.min),
        average: metric.dataFormatter(processedData.total / processedData.numberOfRecords),
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
    displayName: "CPU usage",
    groupByTag: 'workerId',
    valueField: 'cpuUsed',
    dataFormatter: function(input) {
      return (input * 100).toFixed(2) + '%';
    }
  }, {
    metricName: metricsTitle + '_memory',
    displayName: 'RSS Memory Usage',
    groupByTag: 'workerId',
    valueField: 'rss',
    dataFormatter: function(input) {
      return (input/MB).toFixed(2) + 'MB';
    }
  }, {
    metricName: METRIC_KEYS.WORKER_JOB_PROCESS_TIME,
    displayName: 'Job Process Time',
    groupByTag: 'name',
    valueField: 'value',
    dataFormatter: function(input) {
      return input.toFixed(2) + 'ms';
    }
  }, {
    metricName: METRIC_KEYS.WORKER_QUEUE_SIZE,
    displayName: 'Job Queue Size',
    groupByTag: 'name',
    valueField: 'value',
    dataFormatter: function(input) {
      return input;
    }
  }, {
    metricName: METRIC_KEYS.SYNC_API_PROCESS_TIME,
    displayName: 'API Process Time',
    groupByTag: 'fn',
    valueField: 'value',
    dataFormatter: function(input) {
      return input.toFixed(2) + 'ms';
    }
  }, {
    metricName: METRIC_KEYS.MONGODB_OPERATION_TIME,
    displayName: 'Mongodb Operation Time',
    groupByTag: 'fn',
    valueField: 'value',
    dataFormatter: function(input) {
      return input.toFixed(2) + 'ms';
    }
  }];

  if (!redisClient) {
    var errorMessage = 'Redis client is not initialised. An initial sync may not have been performed yet.';
    debugError(errorMessage);
    var redisClientError = new Error(errorMessage);
    return cb(redisClientError);
  }

  async.map(metricsToFetch, function(metric, callback) {
    var metricName = metric.metricName;
    redisClient.lrange([statsNamespace, metricName].join(':'), 0, MAX_NUMBER, function(err, data) {
      if (err) {
        debugError('Failed to get values from redis for key %s  with error : %s', metricName, err);
        return callback();
      }
      var stats = aggregateData(metric, data);
      stats.name = metric.displayName;
      return callback(null, stats)
    });
  }, function(err, results) {
    if (err) {
      return cb(err);
    }
    var reduced = _.reduce(results, function(sofar, result) {
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
    if (process.env.FH_APPNAME) {
      metricsConfig.baseTags = {appname: process.env.FH_APPNAME};
    }
    if (syncConfig.collectStats && redisClientImpl) {
      redisClient = redisClientImpl;
      metricsConfig.enabled = true;
      metricsConfig.backends = metricsConfig.backends || [];
      metricsConfig.backends.push({
        type: 'redis',
        redisClient: redisClientImpl,
        namespace: statsNamespace,
        recordsToKeep: syncConfig.statsRecordsToKeep,
        sendQueueConcurrency: syncConfig.metricsReportConcurrency
      });
    }
    if (syncConfig.metricsInfluxdbHost && syncConfig.metricsInfluxdbPort) {
      metricsConfig.enabled = true;
      metricsConfig.backends = metricsConfig.backends || [];
      metricsConfig.backends.push({
        type: 'influxdb',
        host: syncConfig.metricsInfluxdbHost,
        port: syncConfig.metricsInfluxdbPort,
        sendQueueConcurrency: syncConfig.metricsReportConcurrency
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
