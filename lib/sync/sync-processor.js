var _ = require('underscore');
var async = require('async');
var syncUtil = require('./util');
var debugError = syncUtil.debugError;
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
  var endTime = Date.now();
  var totalTime = endTime - startTime;
  metricsClient.gauge(metrics.KEYS.SYNC_REQUEST_TOTAL_PROCESS_TIME, {success: success}, totalTime);
}

function markDatasetClientAsCompleted(datasetClientId, startTime, callback) {
  syncStorage.updateDatasetClient(datasetClientId, {syncLoopEnd: Date.now(), syncCompleted: true, syncScheduled: null}, function(err){
    if (err) {
      debugError("Error when update dataset client with id %s. error = %s",datasetClientId,err);
    }
    recordProcessTime(startTime, !err);
    return callback();
  });
}

/**
 * Perform the sync operation
 * @param {Object} payload the payload of the sync request
 * @param {Object} payload.id the id of the dataset client
 * @param {String} payload.datasetId the id of the dataset that needs to be synced
 * @param {Object} payload.queryParams the query params that is associated with the dataset
 * @param {Object} payload.metaData the meta data that is associated with the dataset
 * @param {Timestamp} payload.startTime when the sync request is created
 * @param {Number} tries the number of tries of the request
 * @param {Function} callback
 */
function syncWithBackend(payload, tries, callback) {
  var datasetClientId = payload.id;
  var datasetId = payload.datasetId;
  var startTime = payload.startTime;

  if (!datasetClientId || !datasetId) {
    recordProcessTime(startTime, false);
    debugError("no datasetId value found in sync request payload %j" ,payload);
    return callback();
  }

  if (tries > 1) {
    //the request is already run once, but for some reason is not acked, we just make sure it's completed and ack it
    markDatasetClientAsCompleted(datasetClientId, startTime, callback);
    return;
  }

  var queryParams = payload.queryParams || {};
  var metaData = payload.metaData || {};
  //we need to add this so that if this sync processor crashed before reaching the end, the scheduler will still be able to push a sync request
  var expectedTimeout = datasets.getDatasetConfig(datasetId).backendListTimeout * 1000 || 5*60*1000;

  async.waterfall([
    function setSyncStart(cb) {
      var syncLoopStartTime = Date.now();
      syncStorage.updateDatasetClient(datasetClientId, {syncLoopStart: syncLoopStartTime, syncLoopEnd: syncLoopStartTime + expectedTimeout}, function(err, datasetClient){
        return cb(err, datasetClient);
      });
    },
    function listData(datasetClient, cb) {
      listDataWithTimeout({datasetClientId: datasetClientId, datasetId: datasetId, queryParams: queryParams, metaData: metaData}, expectedTimeout, function(err, res) {
        return cb(err, datasetClient, res);
      });
    },
    function saveRecords(datasetClient, recordsWithHash, cb) {
      var toHash = _.pluck(recordsWithHash, 'hash');
      var globalHash = hashProvider.globalHash(datasetId, toHash);
      var globalHashWithCollisionCount = [globalHash, datasetClient.collisionCount].join('_');
      syncStorage.updateDatasetClientWithRecords(datasetClientId, {globalHash: globalHashWithCollisionCount}, recordsWithHash, cb);
    }
  ], function(err){
    if (err) {
      debugError("[%s] Error when sync data with backend. error = %s",datasetId,err);
    }

    markDatasetClientAsCompleted(datasetClientId, startTime, callback);
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
    return syncWithBackend(payload, syncRequest.tries, done);
  }
};
