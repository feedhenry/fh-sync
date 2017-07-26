var _ = require('underscore');
var async = require('async');
var syncUtil = require('./util');
var DatasetClient = require('./DatasetClient');
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;
var interceptors, ackQueue, pendingQueue, syncStorage, syncConfig;

var datasetClientsUpdateQueue;
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
  var itemsToPush = _.map(items, function(item) {
    return _.extend({}, item, extraParams);
  });
  debug("adding %d items to queue %s", itemsToPush.length, targetQueue.getName());
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
  _.each(processedUpdates, function(update) {
    var type = update.type;
    var hash = update.hash;
    updates.hashes[hash] = update;
    updates[type] = updates[type] || {};
    updates[type][hash] = update;
  });
  return updates;
}

/**
 * Remove all the records in `updatesInRequest` from `updatesInDb` if they exist
 * @param {Array} updatesInDb
 * @param {Array} updatesInRequest
 * @returns
 */
function removeUpdatesInRequest(updatesInDb, updatesInRequest) {
  var updatesNotInRequest = _.filter(updatesInDb, function(dbUpdate) {
    var foundInRequest = _.findWhere(updatesInRequest, {hash: dbUpdate.hash});
    return !foundInRequest;
  });
  return updatesNotInRequest;
}

function processSyncAPI(datasetId, params, readDatasetClient, cb) {
  var queryParams = params.query_params || {};
  var metaData = params.meta_data || {};
  var cuid = syncConfig.cuidProducer(params);
  var datasetClient = new DatasetClient(datasetId, {queryParams: queryParams, metaData: metaData});
  var collisionCount = readDatasetClient && readDatasetClient.collisionCount ? readDatasetClient.collisionCount : 0;
  var datasetClientFields = {
    id: datasetClient.getId(),
    datasetId: datasetId,
    collisionCount: collisionCount,
    queryParams: queryParams,
    metaData: metaData,
    lastAccessed: Date.now(),
    active: true
  };
  async.parallel({
    pushDatasetClient: function(callback) {
      //after some loading testing, we noticed that upsertDatasetClient is an atomic operation and requires a lock. If there are  a lot operations on the same document (collection?) those operations will queued up in mongo, which blocks the request.
      //To avoid that, we push the updates into a queue and call upsertDatasetClient with a reasonable concurrency value to void the locking issue.
      datasetClientsUpdateQueue.push(datasetClientFields);
      return callback();
    },
    addAcks: function(callback) {
      var acknowledgements = params.acknowledgements || [];
      debug('[%s] found acks in request. size = %d', datasetId, acknowledgements.length);
      if (syncConfig.syncReqAckLimit && syncConfig.syncReqAckLimit > 0 && acknowledgements.length > syncConfig.syncReqAckLimit) {
        acknowledgements = acknowledgements.slice(0, syncConfig.syncReqAckLimit);
        debug('[%s] too many acks in the request. Only process the first %d items', datasetId, acknowledgements.length);
      }
      debug('[%s] adding acks to queue. size = %d', datasetId, acknowledgements.length);
      if (syncConfig.syncReqWaitForAck) {
        debug('[%s] waiting for ack insert to complete', datasetId);
        addToQueue(acknowledgements, {datasetId: datasetId, cuid: cuid}, ackQueue, callback);
      } else {
        debug('[%s] skip waiting for ack insert', datasetId);
        addToQueue(acknowledgements, {datasetId: datasetId, cuid: cuid}, ackQueue, function(err){
          if (err) {
            debugError('[%s] ack insert error = %s', datasetId, err);
          }
        });
        callback();
      }
    },
    addPendings: function(callback) {
      debug('[%s] adding pendings to queue. size = %d', datasetId, (params.pending && params.pending.length || 0));
      addToQueue(params.pending, {datasetId: datasetId, cuid: cuid, meta_data: metaData, datasetClient: datasetClientFields}, pendingQueue, callback);
    },
    processedUpdates: function(callback) {
      debug('[%s] list updates for client cuid = %s', datasetId, cuid);
      var query = {cuid: cuid};
      var opts = {};
      if (syncConfig.syncReqAckLimit && syncConfig.syncReqAckLimit > 0) {
        opts.limit = syncConfig.syncReqAckLimit;
      }
      syncStorage.listUpdates(datasetId, query, opts, callback);
    }
  }, function(err, results) {
    if (err) {
      debugError('[%s] sync request error = %s %j', datasetId, err, params);
      return cb(err);
    } else {
      debug('[%s] syn API results %j', datasetId, results);
      var globalHash = readDatasetClient ? readDatasetClient.globalHash : undefined;
      //the acknowledgements in the current request will be put on the queue and take some time to process, so don't return them if they are still in the db
      var remainingUpdates = removeUpdatesInRequest(results.processedUpdates, params.acknowledgements);
      var response = {hash: globalHash, updates: formatUpdates(remainingUpdates)};
      interceptors.responseInterceptor(datasetId, queryParams, function(err) {
        if (err) {
          debugError('[%s] sync response interceptor returns error = %s %j', datasetId, err, params);
          return cb(err);
        }
        debug('[%s] sync API response %j', datasetId, response);
        return cb(null, response);
      });
    }
  });
}

/**
 * Process the sync request. It will
 * - validate the request body via the requestInterceptor
 * - check if the dataset client is stopped for sync
 * - create or update the dataset client
 * - process acknowledgements, push each of them to the ackQueue
 * - process pending changes, push each of them to the pendingQueue
 * - list any processed updates for the given client
 * @param {String} datasetId the id of the dataset
 * @param {Object} params the request body, it normally contain those fields:
 * @param {Object} params.query_params the query parameter for the dataset from the client
 * @param {Object} params.meta_data the meta data for the dataset from the client
 * @param {Object} params.__fh an object added by the client sdk. it could have the `cuid` of the client
 * @param {Array} params.pending the pending changes array
 * @param {Array} params.acknowledgements the acknowledgements from the client
 * @param {Function} cb the callback function
 */
function sync(datasetId, params, cb) {
  debug('[%s] process sync request for the dataset', datasetId);
  var queryParams = params.query_params || {};
  var metaData = params.meta_data || {};
  var datasetClient = new DatasetClient(datasetId, {queryParams: queryParams, metaData: metaData});
  debug('[%s] processing sync API request :: query_params = %j:: meta_data = %j', datasetId, queryParams, metaData);
  async.series({
    requestInterceptor: async.apply(interceptors.requestInterceptor, datasetId, params),
    readDatasetClient: function checkDatasetclientStopped(callback) {
      syncStorage.readDatasetClient(datasetClient.getId(), function(err, datasetClientJson) {
        if (err) {
          return callback(err);
        }
        if (datasetClientJson && datasetClientJson.stopped === true) {
          return callback(new Error('sync stopped for dataset ' + datasetId));
        } else {
          return callback(null, datasetClientJson);
        }
      });
    }
  }, function(err, results) {
    if (err) {
      debugError('[%s] sync request returns error = %s %j', datasetId, err, params);
      return cb(err);
    }
    return processSyncAPI(datasetId, params, results.readDatasetClient, cb);
  });
}

module.exports = function(interceptorsImpl, ackQueueImpl, pendingQueueImpl, syncStorageImpl, syncConfigInst) {
  interceptors = interceptorsImpl;
  ackQueue = ackQueueImpl;
  pendingQueue = pendingQueueImpl;
  syncStorage = syncStorageImpl;
  syncConfig = syncConfigInst;
  //we just use an in-memory queue here to update the dataset clients, the main purpose of the update here is:
  //1. make sure a new dataset client will be created if it's never created before. 2. update the `lastAccessed` field of an existing dataset client to determine when a dataset client should be set to "inactive".
  //So even if the app crashes, and some of those records are lost, it means some of the datasetclients may not be synced.
  //But as soon as the clients makes another request, it will be synced again. If the clients doesn't sent the request, then the dataset client should not be synced anyway.
  datasetClientsUpdateQueue = async.queue(function(datasetClientJson, cb) {
    syncStorage.upsertDatasetClient(datasetClientJson.id, datasetClientJson, cb);
  }, syncConfig.datasetClientUpdateConcurrency || 10);
  return sync;
}
