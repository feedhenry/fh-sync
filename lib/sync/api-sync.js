var _ = require('underscore');
var async = require('async');
var syncUtil = require('./util');
var DatasetClient = require('./DatasetClient');
var util = require('util');

var interceptors, ackQueue, pendingQueue, syncStorage;

/**
 * Add the given items to the given queue. For each item, also add the given extraParams.
 * @param {Array} items the items to add to the queue
 * @param {Object} extraParams extra data that should be added to each item
 * @param {MongodbQueue} targetQueue the queue to push the messages to
 * @param {Function} cb the callback function
 */
function addToQueue(items, extraParams, targetQueue, cb) {
  if (!items || items.length === 0) {
    return cb();
  }
  var itemsToPush = _.map(items, function(item){
    return _.extend({}, item, extraParams);
  });
  syncUtil.doLog(syncUtil.SYNC_LOGGER, "debug", "adding " + itemsToPush.length + " items to queue " + targetQueue.getName());
  targetQueue.addMany(itemsToPush, cb);
}

/**
 * Reformat the give processedUpdates array to an object format that is expected by the sync client
 * @param {Array} processedUpdates the array of updates to process
 * @returns {Object} an object that contains the updates with different types
 */
function formatUpdates(processedUpdates) {
  var updates = {
    hashes: {}
  };
  _.each(processedUpdates, function(update){
    var type = update.type;
    var hash = update.hash;
    updates.hashes[type] = updates.hashes[type] || {};
    updates.hashes[type][hash] = update;
  });
  return updates;
}

/**
 * Process the sync request. It will
 * - validate the request body vi the requestInterceptor
 * - create or update the dataset client
 * - process acknowledgements, push each of them to the ackQueue
 * - process pending changes, push each of them to the pendingQueue
 * - list any processed updates for the given client
 * @param {String} datasetId the id of the dataset
 * @param {Object} params the request body, it normally contain those fields:
 * @param {Object} params.query_params the query parameter for the dataset from the client
 * @param {Object} params.meta_data the meta data for the dataset from the client
 * @param {Object} params._fh an object added by the client sdk. it could have the `cuid` of the client
 * @param {Array} params.pending the pending changes array
 * @param {Array} params.acknowledgements the acknowledgements from the client
 * @param {Function} cb the callback function
 */
function sync(datasetId, params, cb) {
  syncUtil.doLog(datasetId, 'info', 'process sync request for dataset ' + datasetId);
  var queryParams = params.query_params || {};
  var metaData = params.meta_data || {};
  var cuid = syncUtil.getCuid(params);
  var datasetClient = new DatasetClient(datasetId, {queryParams: queryParams, metaData: metaData});
  syncUtil.doLog(datasetId, 'debug', 'processing sync API request :: query_params = ' + util.inspect(queryParams) + ' :: meta_data = ' + util.inspect(metaData));
  interceptors.requestInterceptor(datasetId, params, function(err){
    if (err) {
      syncUtil.doLog(datasetId, 'info', 'sync request interceptor returns error = ' + util.inspect(err), params);
      return cb(err);
    }
    async.parallel({
      upsertDatasetClient: function(callback) {
        var datasetClientFields = {id: datasetClient.getId(), datasetId: datasetId,  queryParams: queryParams, metaData: metaData};
        syncStorage.upsertDatasetClient(datasetClient.getId(), datasetClientFields, callback);
      },
      addAcks: function(callback) {
        syncUtil.doLog(datasetId, 'debug', 'adding acks to queue. size = ' + (params.acknowledgements && params.acknowledgements.length || 0));
        addToQueue(params.acknowledgements, {datasetId: datasetId, cuid: cuid}, ackQueue, callback);
      },
      addPendings: function(callback) {
        syncUtil.doLog(datasetId, 'debug', 'adding pendings to queue. size = ' + (params.pending && params.pending.length || 0));
        addToQueue(params.pending, {datasetId: datasetId, cuid: cuid, meta_data: metaData}, pendingQueue, callback);
      },
      processedUpdates: function(callback) {
        syncStorage.listUpdates(datasetId, {cuid: cuid}, callback);
      }
    }, function(err, results){
      if (err) {
        syncUtil.doLog(datasetId, 'error', 'sync request error = ' + util.inspect(err), params);
        return cb(err);
      } else {
        syncUtil.doLog(datasetId, 'debug', 'syn API results ' + util.inspect(results));
        var globalHash = results.upsertDatasetClient.globalHash;
        var response = {hash: globalHash, updates: formatUpdates(results.processedUpdates)};
        interceptors.responseInterceptor(datasetId, queryParams, function(err){
          if (err) {
            syncUtil.doLog(datasetId, 'info', 'sync response interceptor returns error = ' + util.inspect(err), params);
            return cb(err);
          }
          syncUtil.doLog(datasetId, 'debug', 'sync API response ' + util.inspect(response));
          return cb(null, response);
        });
      }
    });
  });
}

module.exports = function(interceptorsImpl, ackQueueImpl, pendingQueueImpl, syncStorageImpl){
  interceptors = interceptorsImpl;
  ackQueue = ackQueueImpl;
  pendingQueue = pendingQueueImpl;
  syncStorage = syncStorageImpl;
  return sync;
}