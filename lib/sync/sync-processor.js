var util = require('util');
var _ = require('underscore');
var syncUtil = require('./util');

var syncCache, dataHandlers, metricsClient, hashProvider;

/**
 * Perform the sync operation
 * @param {Object} payload the payload of the sync request
 * @param {String} payload.dataset_id the id of the dataset that needs to be synced
 * @param {Object} payload.query_params the query params that is associated with the dataset
 * @param {Object} payload.meta_data the meta data that is associated with the dataset 
 * @param {Function} callback
 */
function syncWithBackend(payload, callback) {
  var datasetId = payload.dataset_id;
  var queryParams = payload.query_params || {};
  var metaData = payload.meta_data || {};

  if (!datasetId) {
    syncUtil.doLog(syncUtil.SYNC_LOGGER, "error", "no datasetId value found in sync request payload" + util.inspect(payload));
    return callback();
  }

  //record sync start info
  var syncInfo = {
    syncLoopStarted: new Date().getTime()
  };

  dataHandlers.doList(datasetId, queryParams, metaData, function(err, records){
    if (err) {
      syncInfo.syncLoopEnd = new Date().getTime();
      syncUtil.doLog(datasetId, "error", "error when list data from the backend. error = " + util.inspect(err));
      return callback(err);
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
      var globalHash = hashProvider.globalHash(datasetId, _.pluck(recordsWithHash, 'hash'));
      syncInfo.syncLoopEnd = new Date().getTime();
      syncCache.saveLastSyncDataset(datasetId, globalHash, recordsWithHash, syncInfo, function(err){
        if (err) {
          syncUtil.doLog(datasetId, "error", "error when save data to cache. error = " + util.inspect(err));
        }
        //we don't need to return the error here as there is no need to retry this request
        return callback();
      });
    }
  });
}

module.exports = function(syncCacheImpl, dataHandlersImpl, metricsClientImpl, hashProviderImpl) {
  syncCache = syncCacheImpl;
  dataHandlers = dataHandlersImpl;
  metricsClient = metricsClientImpl;
  hashProvider = hashProviderImpl;

  return function(syncRequest, done) {
    var payload = syncRequest.payload;
    return syncWithBackend(payload, done);
  }
};