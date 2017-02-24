var _ = require('underscore');
var async = require('async');
var util = require('util');
var metrics = require('./sync-metrics');
var syncUtil = require('./util');

var DATASETCLIENTS_COLLECTION = "fhsync-datasetClients";
var RECORDS_UPDATE_CONCURRENCY = 10;

var mongoClient;

/**
 * Get the name of the dataset records collection. 
 * @param {String} datasetId the id of the dataset
 * @returns {String} the record collection name. It should be like `fhsync-<datasetId>-records`.
 */
function getDatasetRecordsCollectionName(datasetId) {
  return ['fhsync', datasetId, "records"].join("-");
}

/**
 * List all the dataset clients docs.
 * @param {Function} cb
 */
function doListDatasetClients(cb) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'doListDatasetClients');
  var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  col.find({}).toArray(function(err, datasetClients){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to list datasetClients due to error ' + util.inspect(err));
    }
    return cb(err, datasetClients);
  });
}

/**
 * Remove the given datasetClients
 * @param {Array} datasetClientsToRemove an array of datasetClients to remove. Each of them should have an `id` field
 * @param {Function} cb
 */
function doRemoveDatasetClients(datasetClientsToRemove, cb) {
  var removeIds = _.pluck(datasetClientsToRemove, 'id');
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'doRemoveDatasetClients removeIds = ' + util.inspect(removeIds));
  var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  col.deleteMany({'id': {'$in': removeIds}}, function(err, deleteResult){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to delete datasetClients due to error ' + util.inspect(err));
    }
    return cb(err, deleteResult);
  });
}

/**
 * Update the dataset client
 * @param {String} datasetClientId the datasetClient id
 * @param {Object} fields the fields that need to be updated
 * @param {Boolean} upsert if true, the record will be created if can't be found
 * @param {Function} cb
 */
function doUpdateDatasetClient(datasetClientId, fields, upsert, cb) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'doUpdateDatasetClient datasetClientId = ' + datasetClientId + ' :: fields = ' + util.inspect(fields));
  var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  col.findOneAndUpdate({id: datasetClientId}, {'$set': fields}, {upsert: upsert}, function(err, result){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to update datasetClients due to error ' + util.inspect(err) + ' :: datasetClientId = ' + datasetClientId + ' :: fields = ' + util.inspect(fields));
      return cb(err);
    }
    return cb(null, result.value);
  });
}

/**
 * Read the dataset client from db
 * @param {String} datasetClientId the id of the datasetClient
 * @param {Function} cb
 */
function doReadDatasetClient(datasetClientId, cb) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'doReadDatasetClient datasetClientId = ' + datasetClientId);
  var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  col.findOne({id: datasetClientId}, function(err, datasetClient){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to read datasetClient due to error ' + util.inspect(err) + ' :: datasetClientId = ' + datasetClientId);
    }
    return cb(err, datasetClient);
  });
}

/**
 * List the local records for the given datasetClient from the `fhsync-<datasetId>-records` collection
 * @param {Object} datasetClientJson the json object of the datasetClient. It should have the `datasetId` and `recordUids`
 * @param {Object} projection can be used to specify what fields should be returned for the records. Each record will have `uid`, 'hash' and `data` fields.
 * @param {Function} cb
 */
function listDatasetClientRecords(datasetClientJson, projection, cb) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'listDatasetClientRecords datasetClientJson = ' + util.inspect(datasetClientJson));
  var datasetId = datasetClientJson.datasetId;
  var recordUids = datasetClientJson.recordUids || [];
  if (recordUids.length > 0) {
    var datasetRecordsCol = mongoClient.collection(getDatasetRecordsCollectionName(datasetId));
    var cursor = datasetRecordsCol.find({}).filter({'uid': {'$in': recordUids}});
    if (projection) {
      cursor = cursor.project(projection)
    }
    return cursor.toArray(function(err, records){
      if (err) {
        syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to list datasetClient records due to error ' + util.inspect(err) + ' :: datasetClientJson = ' + util.inspect(datasetClientId));
      }
      return cb(err, records);
    });
  } else {
    return cb(null, []);
  }
}

/**
 * Either insert, update or delete the given records from the `fhsync-<datasetId>-records` collection.
 * @param {String} datasetId
 * @param {Array} records the array of records that need to be updated
 * @param {Function} cb
 */
function upsertOrDeleteDatasetRecords(datasetId, records, cb) {
  var datasetRecordsCol = mongoClient.collection(getDatasetRecordsCollectionName(datasetId));
  syncUtil.doLog(datasetId, 'debug', 'upsertOrDeleteDatasetRecords records.length = ' + records.length);
  async.mapLimit(records, RECORDS_UPDATE_CONCURRENCY, function(record, callback){
    var op = record.op;
    delete record.op;
    var update = {'$set': record};
    if (op === 'update') {
      update['$inc'] = {'refs': 1};
    } else if (op === 'delete') {
      update['$inc'] = {'refs': -1};
    }
    datasetRecordsCol.findOneAndUpdate({uid: record.uid}, update, {upsert: true}, function(err, updated){
      if (err) {
        return callback(err);
      }
      if (updated.value && updated.value.ref <= 0) {
        //no more references to the record, delete it
        datasetRecordsCol.findOneAndDelete({uid: updated.value.uid}, callback);
      } else {
        return callback(null, updated);
      }
    });
  }, function(err, updates){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to upsertOrDeleteDatasetRecords due to error ' + util.inspect(err) + ' :: datasetId = ' + datasetId);
      return cb(err);
    }
    return cb(null, _.pluck(updates, 'value'));
  });
}

/**
 * Compute the diff between the 2 objects based on the hash value
 * @param {Object} localRecords
 * @param {Object} newRecords
 * @returns an object that contains the diff
 */
function diffRecords(localRecords, newRecords) {
  var recordsDiff = {};
  _.each(newRecords, function(record, uid){
    if (localRecords[uid]) {
      if (localRecords[uid].hash !== record.hash) {
        record.op = "update";
        recordsDiff[uid] = record;
      }
    } else {
      record.op = "update";
      recordsDiff[uid] = record;
    }
  });
  _.each(localRecords, function(record, uid){
    if (!newRecords[uid]) {
      record.op = "delete"
      recordsDiff[uid] = record;
    }
  });
  return recordsDiff;
}

/**
 * Save datasetClient json object to the `fhsync-datasetClients` collection, as well as the associated records for the datasetClient to the `fhsync-<datasetId>-records` collection
 * @param {String} datasetClientId the id of the datasetClient
 * @param {Object} fields the fields that need to be updated for the given datasetClient
 * @param {Array} records the array of records that needs to be saved to the `fhsync-<datasetId>-records` collection
 * @param {Function} callback
 */
function doUpdateDatasetClientWithRecords(datasetClientId, fields, records, callback) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'doUpdateDatasetClientWithRecords datasetClientId = ' + datasetClientId + ' :: records.length = ' + records.length);
  async.waterfall([
    async.apply(doReadDatasetClient, datasetClientId),
    function listRecords(datasetClientJson, next) {
      //we don't need to data field here as it will not be used
      listDatasetClientRecords(datasetClientJson, {uid: 1, hash: 1}, function(err, localRecords){
        return next(err, datasetClientJson, localRecords);
      });
    },
    //to reduce the number of db operations, we try to compute only the records that need to be changed here.
    function diff(datasetClientJson, localRecords, next) {
      var recordsDiff = diffRecords(syncUtil.convertToObject(localRecords), syncUtil.convertToObject(records));
      return next(null, datasetClientJson, recordsDiff);
    },
    function updateRecords(datasetClientJson, recordsDiff, next){
      var datasetId = datasetClientJson.datasetId;
      upsertOrDeleteDatasetRecords(datasetId, recordsDiff, function(err){
        return next(err, datasetClientJson);
      });
    },
    //make sure we only update the dataset client at the end of the operation. Will should cause the globalHash value to be changed for the datasetClient, which should trigger clients to sync again.
    function updateDatasetClient(datasetClientJson, next) {
      datasetClientJson = _.extend({}, datasetClientJson, fields);
      datasetClientJson.recordUids = _.pluck(records, 'uid');
      doUpdateDatasetClient(datasetClientJson.datasetId, datasetClientJson, false, next);
    }
  ], function(err, updatedDatasetClient){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to doUpdateDatasetClientWithRecords due to error ' + util.inspect(err) + ' :: datasetClientId = ' + datasetClientId + ' :: fields = ' + util.inspect(fields));
    }
    return callback(err, updatedDatasetClient);
  });
}

/**
 * Read the dataset client object from the `fhsync-datasetClients` collection, as well as the associated records for the datasetClient from the `fhsync-<datasetId>-records` collection.
 * The records will be added to the datasetClient json object with the key `records`
 * @param {String} datasetClientId
 * @param {Function} callback
 */
function doReadDatasetClientWithRecords(datasetClientId, callback) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'doReadDatasetClientWithRecords datasetClientId = ' + datasetClientId );
  async.waterfall([
    async.apply(doReadDatasetClient, datasetClientId),
    function listRecords(datasetClientJson, next) {
      listDatasetClientRecords(datasetClientJson, null, function(err, localRecords){
        return next(err, datasetClientJson, localRecords);
      });
    }
  ], function(err, datasetClientJson, localRecords){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to doReadDatasetClientWithRecords due to error ' + util.inspect(err) + ' :: datasetClientId = ' + datasetClientId);
      return callback(err);
    }
    datasetClientJson.records = localRecords;
    return callback(null, datasetClientJson);
  });
}

module.exports = function(mongoClientImpl) {
  mongoClient = mongoClientImpl;
  return {
    /**
     * list the currently managed dataset clients
     * @param {Function} callback
     */
    listDatasetClients: function(callback) {
      metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doListDatasetClients)(callback);
    },

    /**
     * remove the given datasetClients from the storage. Each datasetclient should have at least the `id` field
     * @param {Array} datasetClientsToRemove
     * @param {Function} callback
     */
    removeDatasetClients: function(datasetClientsToRemove, callback) {
      if (!datasetClientsToRemove.length) {
        return callback();
      }
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doRemoveDatasetClients)(datasetClientsToRemove, callback);
    },

    /**
     * update the given dataset client
     * @param {String} datasetClientId the id of the datasetClient
     * @param {Object} fields the fields to update
     * @param {Function} callback
     */
    updateDatasetClient: function(datasetClientId, fieldsToUpdate, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doUpdateDatasetClient)(datasetClientId, fieldsToUpdate, false, callback);
    },

    /**
     * Create the give dataset if it doesn't no exist, or update the existing one.
     * Should return the datasetClient instance in the callback
     * @param {String} datasetClientId the id of the datasetClient
     * @param {String} fields the fields to upsert
     * @param {Function} callback
     */
    upsertDatasetClient: function(datasetClientId, fields, callback) {
      fields.id = datasetClientId;
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doUpdateDatasetClient)(datasetClientId, fields, true, callback);    
    },

    /**
     * update the given dataset client with the given records
     * @param {String} datasetClientId the id of the datasetClient
     * @param {Object} fields the fields to update
     * @param {Array} records an array of records to save
     * @param {Function} callback
     */
    updateDatasetClientWithRecords: function(datasetClientId, fields, records, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doUpdateDatasetClientWithRecords)(datasetClientId, fields, records, callback);
    },

    /**
     * Read the given datasetclient record, and its assoicated records
     * @param {String} datasetClientId
     * @param {Function} callback
     */
    readDatasetClientWithRecords: function(datasetClientId, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doReadDatasetClientWithRecords)(datasetClientId, callback);
    },

    /**
     * find the delete the given sync update
     * @param {String} datasetId
     * @param {Object} acknowledgement
     * @param {Function} callback
     */
    findAndDeleteUpdate: function() {

    },

    /**
     * Save the given sync update
     * @param {String} datasetId
     * @param {Object} syncUpdateFields
     * @param {Function} callback
     */
    saveUpdate: function() {

    },

    /**
     * List the updates that match the given list criteria
     * @param {String} datasetId
     * @param {Object} criteria the list criteria, a mongodb query object
     * @param {Function} callback
     */
    listUpdates: function() {

    }
  };
};