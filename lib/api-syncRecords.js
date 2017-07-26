var async = require('async');
var _ = require('underscore');
var DatasetClient = require('./DatasetClient');
var util = require('util');
var syncUtil = require('./util');
var SYNC_UPDATE_TYPES = require('./pending-processor').SYNC_UPDATE_TYPES;
var convertToObject = syncUtil.convertToObject;
var syncStorage, pendingQueue, syncConfig;
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;

/**
 * List the records for the given datasetClient
 * @param {DatasetClient} datasetClient
 * @param {Function} cb
 */
function listLocalDatasetClientData(datasetClient, cb) {
  syncStorage.readDatasetClientWithRecords(datasetClient.getId(), function(err, datasetClientsWithRecords) {
    if (err) {
      return cb(err);
    }
    //no one sync loop has completed yet, return null
    if (!datasetClientsWithRecords || !datasetClientsWithRecords.syncCompleted) {
      return cb(null, null);
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
  syncStorage.listUpdates(datasetId, {
    type: SYNC_UPDATE_TYPES.APPLIED,
    cuid: clientInfo.cuid,
    timestamp: {$gt: lastSyncEndTime}
  }, null, cb);
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
  }, function(err, results) {
    if (err) {
      return cb(err);
    }
    return cb(null, results.appliedUpdatesSinceLastSync, results.pendingChangesForClient);
  });
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
  _.each(appliedUpdates, function(update, recordUid) {
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
  _.each(pendingChanges, function(pendingChange, uid) {
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
  _.each(serverRecords, function(serverRecord, serverRecordUid) {
    var serverRecHash = serverRecord.hash;
    //record is in both client and server
    if (clientRecords[serverRecordUid]) {
      //hash value doesn't match, needs update
      if (clientRecords[serverRecordUid] !== serverRecHash) {
        debug('[%s] Updating client record %s  client hash=%s', datasetId, serverRecordUid, clientRecords[serverRecordUid]);
        updates[serverRecordUid] = serverRecord;
      }
    } else {
      //record is not in the client, needs create
      debug('[%s] Creating client record %s', datasetId, serverRecordUid);
      creates[serverRecordUid] = serverRecord;
    }
  });

  _.each(clientRecords, function(clientRecordHash, clientRecordUid) {
    if (!serverRecords[clientRecordUid]) {
      //the record is in the client but not in the server, need delete
      debug('[%s] Deleting client record %s', datasetId, clientRecordUid);
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
 * @param {Object} params.__fh an object added by the client sdk. it should have the `cuid` of the client
 * @param {Object} params.clientRecs the client records
 * @param {Function} cb
 */
function syncRecords(datasetId, params, cb) {
  debug('[%s] process syncRecords request', datasetId);
  var queryParams = params.query_params || {};
  var metaData = params.meta_data || {}; //NOTE: the client doesn't send in this value for syncRecords ATM
  var cuid = syncConfig.cuidProducer(params);
  var datasetClient = new DatasetClient(datasetId, {queryParams: queryParams, metaData: metaData});
  var clientRecords = params.clientRecs || {};
  async.waterfall([
    function checkDatasetclientStopped(callback) {
      syncStorage.readDatasetClient(datasetClient.getId(), function(err, datasetClientJson) {
        if (err) {
          return callback(err);
        }
        if (!datasetClientJson) {
          var errMsg = "unknown dataset client datasetId = " + datasetId + " :: queryParams = " + util.inspect(queryParams);
          debugError("[%s] %s", datasetId, errMsg);
          return callback(errMsg);
        }
        if (datasetClientJson.stopped === true) {
          return callback(new Error('sync stopped for dataset ' + datasetId));
        } else {
          return callback();
        }
      });
    },
    async.apply(listLocalDatasetClientData, datasetClient),
    function listOtherChanges(localDatasetData, callback) {
      if (localDatasetData) {
        listChangesNotInLocalDataset(datasetId, localDatasetData.syncLoopEnd, {cuid: cuid}, function(err, appliedUpdates, clientPendingChanges) {
          return callback(err, localDatasetData, appliedUpdates, clientPendingChanges);
        });
      } else {
        return callback();
      }
    }
  ], function(err, localDatasetData, appliedUpdatesSinceLastSync, pendingUpdates) {
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
    debug('[%s] syncRecords API response %j', datasetId, res);
    return cb(null, res);
  });
}

module.exports = function(syncStorageImpl, pendingQueueImpl, syncConfigImpl) {
  syncStorage = syncStorageImpl;
  pendingQueue = pendingQueueImpl;
  syncConfig = syncConfigImpl;
  return syncRecords;
};
