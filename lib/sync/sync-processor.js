var util = require('util');
var _ = require('underscore');
var async = require('async');
var syncUtil = require('./util');
var metrics = require('./sync-metrics');
var datasets = require('./datasets');

var syncStorage, dataHandlers, metricsClient, hashProvider;

function listDatafromBackend(datasetId, queryParams, metaData, cb) {
  dataHandlers.doList(datasetId, queryParams, metaData, function(err, records){
    if (err) {
      return cb(err);
    } else {
      //now we have the results from the backend, we should:
      //iterate through them
      //get the hash of each record, try save them in redis
      //generate the global hash
      //save the info in redis
      var recordsWithHash = _.map(records, function(data, uid){
        var recHash = hashProvider.recordHash(datasetId, data);
        return {
          uid: uid,
          data: data,
          hash: recHash
        };
      });
      return cb(null, recordsWithHash);
    }
  });
}

function listDataWithTimeout(params, timeout, cb) {
  async.race([
    function(timeoutCallback) {
      setTimeout(function(){
        timeoutCallback(new Error('Timeout error occured when try to list data from backend for datasetClient ' + params.datasetClientId));
      }, timeout);
    },
    function(listCallback) {
      listDatafromBackend(params.datasetId, params.queryParams, params.metaData, listCallback);
    }
  ], cb);
}

function recordProcessTime(startTime, success) {
  var endTime = new Date().getTime();
  var totalTime = endTime - startTime;
  metricsClient.gauge(metrics.KEYS.SYNC_REQUEST_TOTAL_PROCESS_TIME, {success: success}, totalTime);
}

/**
 * Perform the sync operation
 * @param {Object} payload the payload of the sync request
 * @param {Object} payload.id the id of the dataset client
 * @param {String} payload.datasetId the id of the dataset that needs to be synced
 * @param {Object} payload.queryParams the query params that is associated with the dataset
 * @param {Object} payload.metaData the meta data that is associated with the dataset
 * @param {Timestamp} payload.startTime when the sync request is created 
 * @param {Function} callback
 */
function syncWithBackend(payload, callback) {
  var datasetClientId = payload.id;
  var datasetId = payload.datasetId;
  var startTime = payload.startTime;

  if (!datasetClientId || !datasetId) {
    recordProcessTime(startTime, false);
    syncUtil.doLog(syncUtil.SYNC_LOGGER, "error", "no datasetId value found in sync request payload" + util.inspect(payload));
    return callback();
  }

  var queryParams = payload.queryParams || {};
  var metaData = payload.metaData || {};
  //we need to add this so that if this sync processor crashed before reaching the end, the scheduler will still be able to push a sync request
  var expectedTimeout = datasets.getDatasetConfig(datasetId).backendListTimeout * 1000 || 5*60*1000;

  async.waterfall([
    function setSyncStart(cb) {
      var syncLoopStartTime = new Date().getTime();
      syncStorage.updateDatasetClient(datasetClientId, {syncLoopStart: syncLoopStartTime, syncLoopEnd: syncLoopStartTime + expectedTimeout}, function(err){
        return cb(err);
      });
    },
    function listData(cb) {
      listDataWithTimeout({datasetClientId: datasetClientId, datasetId: datasetId, queryParams: queryParams, metaData: metaData}, expectedTimeout - 2*1000, cb);
    },
    function saveRecords(recordsWithHash, cb) {
      var globalHash = hashProvider.globalHash(datasetId, _.pluck(recordsWithHash, 'hash'));
      syncStorage.updateDatasetClientWithRecords(datasetClientId, {globalHash: globalHash}, recordsWithHash, cb);
    }
  ], function(err){
    if (err) {
      syncUtil.doLog(datasetId, "error", "Error when sync data with backend. error = " + util.inspect(err));
    }

    syncStorage.updateDatasetClient(datasetClientId, {syncLoopEnd: new Date().getTime()}, function(err){
      if (err) {
        syncUtil.doLog(datasetId, "error", "Error when update dataset client with id " + datasetClientId + ". error = " + util.inspect(err));
      }
      recordProcessTime(startTime, !err);
      return callback();
    });
  });
}

//TODO: look at how to allow override sync options
module.exports = function(syncStorageImpl, dataHandlersImpl, metricsClientImpl, hashProviderImpl) {
  syncStorage = syncStorageImpl;
  dataHandlers = dataHandlersImpl;
  metricsClient = metricsClientImpl;
  hashProvider = hashProviderImpl;

  return function(syncRequest, done) {
    var payload = syncRequest.payload;
    return syncWithBackend(payload, done);
  }
};