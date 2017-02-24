var async = require('async');
var _ = require('underscore');
var DatasetClient = require('./DatasetClient');
var syncUtil = require('./util');
var SYNC_UPDATE_TYPES = require('./pending-processor').SYNC_UPDATE_TYPES;
var syncStorage, pendingQueue;

/**
 * List the records for the given datasetClient
 * @param {DatasetClient} datasetClient 
 * @param {Function} cb
 */
function listLocalDatasetClientData(datasetClient, cb) {
  syncStorage.readDatasetClientWithRecords(datasetClient.getId(), function(err, datasetClientsWithRecords){
    if (err) {
      return cb(err);
    }
    //no one sync loop has completed yet, return null
    if (!datasetClientsWithRecords.syncCompleted) {
      return cb();
    } else {
      return cb(null, datasetClientsWithRecords);
    }
  });
}

/**
 * List the applied changes since the last sync loop for the given client
 * @param {String} datasetId the id of the dataset
 * @param {Number} lastSyncEndTime the timestamp of when the last sync loop completed
 * @param {Object} clientInfo the client info. Should contain the cuid
 * @param {Function} cb
 */
function listAppliedChangeSinceLastSync(datasetId, lastSyncEndTime, clientInfo, cb) {
  syncStorage.listUpdates(datasetId, {type: SYNC_UPDATE_TYPES.APPLIED, cuid: clientInfo.cuid, timestamp: {$gt: lastSyncEndTime}}, cb);
}

/**
 * List the pending changes for the given client that are still waiting to be processed
 * @param {String} datasetId
 * @param {Object} clientInfo the client info. Should contain the cuid
 * @param {Function} cb
 */
function listPendingChangesForClient(datasetId, clientInfo, cb) {
  pendingQueue.search({datasetId: datasetId, cuid: clientInfo.cuid}, cb);
}

/**
 * List all the possible changes that are not in the current local dataset copy yet.
 * It includes:
 * - the updates that are applied since last sync loop run from the given client
 * - the pending changes that are still waiting to be processed for the given client
 * @param {String} datasetId
 * @param {Number} lastSyncTime the timestamp of when the last sync loop completed
 * @param {Object} clientInfo the client info. Should contain the cuid
 * @param {Function} cb
 */
function listChangesNotInLocalDataset(datasetId, lastSyncTime, clientInfo, cb) {
  async.parallel({
    appliedUpdatesSinceLastSync: async.apply(listAppliedChangeSinceLastSync, datasetId, lastSyncTime, clientInfo),
    pendingChangesForClient: async.apply(listPendingChangesForClient, datasetId, clientInfo)
  }, function(err, results){
    if (err) {
      return cb(err);
    }
    return cb(null, results.appliedUpdatesSinceLastSync, results.pendingChangesForClient);
  });
}

/**
 * convert the given array to an object, use the `uid` field of each item as the key
 * @param {Array} itemArr
 * @returns an object
 */
function convertToObject(itemArr) {
  var obj = {};
  _.each(itemArr, function(item){
    obj[item.uid] = item;
  });
  return obj;
}

/**
 * We have some updates that are applied to the backed since last sync run. However, those updates are not in the 
 * localDatasetClient yet (they will in after next sync run). But those updates are applied on the client already. 
 * This means when we compute the delta between the client records and the localDatasetClient, those changes will be reverted from the client.
 * To avoid that, we loop through those updates and remove them both from the clientRecords and localDatasetClient.
 * This way there will be no delta for those records and the client will keep there records.
 * 
 * @param {any} clientRecords
 * @param {any} localDatasetClient
 * @param {any} appliedUpdates
 */
function removeAppliedUpdates(clientRecords, localDatasetClient, appliedUpdates) {
  _.each(appliedUpdates, function(update, recordUid){
    if (clientRecords[recordUid]) {
      delete clientRecords[recordUid];
    }
    if (localDatasetClient[recordUid]) {
      delete localDatasetClient[recordUid];
    }
    //cover the creation cases. The uid could change. Client may still have the old uid.
    if (update.oldUid) {
      var oldUid = update.oldUid;
      if (clientRecords[oldUid]) {
        delete clientRecords[oldUid];
      }
    }
  });
}

/**
 * We have some pending changes sent in by the client and waiting in the queue. They are not processed yet so the backend or our localDataset don't have those changes.
 * We don't know if those changes will be applied or not. But they are already applied on the client which means if we compute the delta as it is, those changes will be reverted.
 * To avoid that, we will remove those changes from both the client and the localDataset so that the client will keep them for now.
 * @param {any} clientRecordds
 * @param {any} localDatasetClient
 * @param {any} pendingChanges
 */
function removePendingChanges(clientRecords, localDatasetClient, pendingChanges) {
  _.each(pendingChanges, function(pendingChange, uid){
    if (clientRecords[uid]) {
      delete clientRecords[uid];
    }
    if (localDatasetClient[uid]) {
      delete localDatasetClient[uid];
    }
  });
}

/**
 * Find out the differences between the clientRecords and the serverRecords
 * @param {String} datasetId the id of the dataset
 * @param {Object} clientRecords client records. The key should be the uid of each record, and the value should be the hash of each record
 * @param {Object} serverRecords server records. The key should be the uid of each record, and the value should contain the `data` and the `hash` of each record
 * @returns the records that should be created/updated/deleted from the client
 */
function computeDelta(datasetId, clientRecords, serverRecords) {
  var creates = {};
  var updates = {};
  var deletes = {};
  _.each(serverRecords, function(serverRecord, serverRecordUid){
    var serverRecHash = serverRecord.hash;
    //record is in both client and server
    if (clientRecords[serverRecordUid]) {
      //hash value doesn't match, needs update
      if (clientRecords[serverRecordUid] !== serverRecHash) {
        syncUtil.doLog(datasetId, 'verbose', 'Updating client record ' + serverRecordUid + ' client hash=' + clientRecords[serverRecordUid]);
        updates[serverRecordUid] = serverRecord;
      }
    } else {
      //record is not in the client, needs create
      syncUtil.doLog(datasetId, 'verbose', 'Creating client record ' + serverRecordUid);
      creates[serverRecordUid] = serverRecord;
    }
  });

  _.each(clientRecords, function(clientRecordHash, clientRecordUid){
    if (!serverRecords[clientRecordUid]) {
      //the record is in the client but not in the server, need delete
      syncUtil.doLog(datasetId, 'verbose', 'Deleting client record ' + clientRecordUid);
      deletes[clientRecordUid] = {};
    }
  });

  return {
    create: creates,
    update: updates,
    delete: deletes
  };
}

/**
 * Sync the data records for the given client
 * @param {String} datasetId 
 * @param {Object} params the request body, it normally contain those fields:
 * @param {Object} params.query_params the query parameter for the dataset from the client
 * @param {Object} params.meta_data the meta data for the dataset from the client
 * @param {Object} params._fh an object added by the client sdk. it should have the `cuid` of the client
 * @param {Object} params.clientRecs the client records
 * @param {Function} cb
 */
function syncRecords(datasetId, params, cb) {
  syncUtil.doLog(datasetId, 'info', 'process sync request for dataset ' + datasetId);
  var queryParams = params.query_params || {};
  //TODO: currently the sync client do not send in the metaData, so how do we get the right datasetClient?
  //we can either make changes to the sync client to send in the meta_data (we probably should, as it will allow us to add the interceptors to protect the endpoint)
  //or, we don't pass in the metaData to generate the dataset client id (now think about it, why do we need the metaData as part of the datasetClient id anyway? The query_params should be enough)?
  //but either way, we need to get the right dataset client
  var metaData = params.meta_data || {};
  var cuid = syncUtil.getCuid(params);
  var datasetClient = new DatasetClient(datasetId, {queryParams: queryParams, metaData: metaData});
  var clientRecords = params.clientRecs;
  async.waterfall([
    async.apply(listLocalDatasetClientData, datasetClient),
    function listOtherChanges(localDatasetData, callback) {
      if (localDatasetData) {
        listChangesNotInLocalDataset(datasetId, localDatasetData.syncLoopEnd, {cuid: cuid}, function(err, appliedUpdates, clientPendingChanges){
          return callback(err, localDatasetData, appliedUpdates, clientPendingChanges);
        });
      } else {
        return callback();
      }
    }
  ], function(err, localDatasetData, appliedUpdatesSinceLastSync, pendingUpdates){
    if (err) {
      return cb(err);
    }
    if (!localDatasetData) {
      return cb(null, {});
    }
    var localDatasetDataObj = convertToObject(localDatasetData.records);
    var appliedUpdatesSinceLastSyncObj = convertToObject(appliedUpdatesSinceLastSync);
    var pendingUpdatesObj = convertToObject(pendingUpdates);
    
    removeAppliedUpdates(clientRecords, localDatasetDataObj, appliedUpdatesSinceLastSyncObj);
    removePendingChanges(clientRecords, localDatasetDataObj, pendingUpdatesObj);

    var delta = computeDelta(datasetId, clientRecords, localDatasetDataObj);
    var res = delta;
    res.hash = localDatasetData.globalHash;
    return cb(null, res);
  });
}

module.exports = function(syncStorageImpl, pendingQueueImpl) {
  syncStorage = syncStorageImpl;
  pendingQueue = pendingQueueImpl;
  return syncRecords;
};