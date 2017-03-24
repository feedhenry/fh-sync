var metrics = require('../sync-metrics');
var syncUtil = require('../util');
var async = require('async');
var _ = require('underscore');
var debug = syncUtil.debug;
var DATASETCLIENTS_COLLECTION = "fhsync_datasetClients";
var RECORDS_UPDATE_CONCURRENCY = 10;
var mongoClient;
var cacheClient;


/**
 * The json representation of the dataset clients.
 * @typedef {Object} storage~DatasetClient
 * @property {String} id - the unique id of the datasetClient.
 * @property {String} datasetId - the dataset id of the datasetClient
 * @property {Object} queryParams - the query parameter associated with the dataset client
 * @property {Object} metaData - the metaData associated with the dataset client
 * @property {Object} config - the config option of the dataset client (inherited from the dataset)
 * @property {Object} props - internal object that is used to save the sync status of the dataset client
 * @property {String} globalHash - the global hash value of the data in the dataset client
 */

/**
 * The dataset client record object
 * @typedef {Object} storage~DatasetClientRecord
 * @property {String} uid - the uid of the record
 * @property {String} hash - the hash value of the data field of the record
 * @property {Object} data - the actual data of the record
 */

/**
 * List all the dataset clients docs.
 * @param {Function} cb
 */
function doListDatasetClients(cb) {
  debug('doListDatasetClients');
  var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  col.find({}).toArray(function(err, datasetClients) {
    if (err) {
      debug('Failed to list datasetClients due to error %j', err);
    }
    return cb(err, datasetClients);
  });
}

/**
 * Remove the given datasetClients
 * @param {storage~DatasetClient[]} datasetClientsToRemove an array of datasetClients to remove. Each of them should have an `id` field
 * @param {Function} cb
 */
function doRemoveDatasetClients(datasetClientsToRemove, cb) {
  var removeIds = _.pluck(datasetClientsToRemove, 'id');
  debug('doRemoveDatasetClients removeIds = %j', removeIds);
  async.map(removeIds, doRemoveDatasetClientWithRecords, function(err, deleteResult) {
    if (err) {
      debug('Failed to delete datasetClients due to error %j', err);
    }
    return cb(err, deleteResult);
  });
}

/**
 * Remove the datasetClient that matches the given datasetClientId, and also remove the references of the datasetClient from the records.
 * @param {String} datasetClientId
 * @param {Function} cb
 */
function doRemoveDatasetClientWithRecords(datasetClientId, cb) {
  debug('doRemoveDatasetClientWithRecords datasetClientId = ' + datasetClientId);
  async.waterfall([
    async.apply(doReadDatasetClientWithRecords, datasetClientId),
    function removeRecords(datasetClientWithRecords, callback) {
      var records = datasetClientWithRecords.records;
      if (records.length > 0) {
        records = syncUtil.convertToObject(records);
        _.each(records, function(record) {
          record.op = "delete";
          delete record._id;
        });
        upsertOrDeleteDatasetRecords(datasetClientWithRecords.datasetId, datasetClientId, records, function(err) {
          return callback(err, datasetClientWithRecords);
        });
      } else {
        return callback(null, datasetClientWithRecords);
      }
    },
    function deleteDatasetClient(datasetClientWithRecords, callback) {
      var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
      col.findOneAndDelete({'id': datasetClientId}, function(err, deleted) {
        return callback(err, deleted);
      });
    }
  ], function(err, result) {
    if (err) {
      debug('Failed to doRemoveDatasetClientWithRecords due to error %j', err);
    }
    return cb(err, result.value);
  });
}

/**
 * Either insert, update or delete the given records from the `fhsync-<datasetId>-records` collection.
 * @param {String} datasetId
 * @param {storage~DatasetClientRecord[]} records the array of records that need to be updated
 * @param {Function} cb
 */
function upsertOrDeleteDatasetRecords(datasetId, datasetClientId, records, cb) {
  var datasetRecordsCol = mongoClient.collection(getDatasetRecordsCollectionName(datasetId));
  debug('upsertOrDeleteDatasetRecords diff records = %j', records);
  async.mapLimit(records, RECORDS_UPDATE_CONCURRENCY, function(record, callback) {
    var op = record.op;
    var fields = {
      uid: record.uid,
      hash: record.hash,
      data: record.data
    };
    var update = {'$set': fields};
    if (op === 'update') {
      //$addToSet only adds the value to the array if it doesn't exist
      update['$addToSet'] = {'refs': datasetClientId};
    } else if (op === 'delete') {
      //remove the ref
      update['$pull'] = {'refs': datasetClientId};
    }
    datasetRecordsCol.findOneAndUpdate({uid: record.uid}, update, {upsert: true, returnOriginal: false}, function(err, updated) {
      if (err) {
        return callback(err);
      }
      if (updated.value && (!updated.value.refs || (updated.value.refs && updated.value.refs.length === 0))) {
        //no more references of the record, delete it
        datasetRecordsCol.findOneAndDelete({uid: updated.value.uid}, function(err) {
          return callback(err);
        });
      } else {
        datasetRecordsCol.findOne({uid: record.uid}, callback);
      }
    });
  }, function(err, updates) {
    if (err) {
      debug('Failed to upsertOrDeleteDatasetRecords due to error %j :: datasetId = %s', err, datasetId);
      return cb(err);
    }
    var returned = _.compact(updates);
    return cb(null, returned);
  });
}


/**
 * List the local records for the given datasetClient from the `fhsync-<datasetId>-records` collection
 * @param {storage~DatasetClient} datasetClientJson the json object of the datasetClient. It should have the `datasetId` and `recordUids`
 * @param {Object} projection can be used to specify what fields should be returned for the records. Each record will have `uid`, 'hash' and `data` fields.
 * @param {Function} cb
 */
function listDatasetClientRecords(datasetClientJson, projection, cb) {
  debug('listDatasetClientRecords datasetClientJson = %j', datasetClientJson);
  var datasetId = datasetClientJson.datasetId;
  var recordUids = datasetClientJson.recordUids || [];
  if (recordUids.length > 0) {
    var datasetRecordsCol = mongoClient.collection(getDatasetRecordsCollectionName(datasetId));
    var cursor = datasetRecordsCol.find({}).filter({'uid': {'$in': recordUids}});
    if (projection) {
      cursor = cursor.project(projection);
    }
    return cursor.toArray(function(err, records) {
      if (err) {
        debug('[%s] Failed to list datasetClient records due to error %j :: datasetClientJson = %j', err, datasetClientJson);
      }
      return cb(err, records);
    });
  } else {
    return cb(null, []);
  }
}

/**
 * Read the dataset client object from the `fhsync-datasetClients` collection, as well as the associated records for the datasetClient from the `fhsync-<datasetId>-records` collection.
 * The records will be added to the datasetClient json object with the key `records`
 * @param {String} datasetClientId
 * @param {Function} callback
 */
function doReadDatasetClientWithRecords(datasetClientId, callback) {
  debug('doReadDatasetClientWithRecords datasetClientId = ', datasetClientId);
  async.waterfall([
    async.apply(doReadDatasetClient, datasetClientId),
    function listRecords(datasetClientJson, next) {
      if (datasetClientJson) {
        listDatasetClientRecords(datasetClientJson, null, function(err, localRecords) {
          return next(err, datasetClientJson, localRecords);
        });
      } else {
        return next();
      }
    }
  ], function(err, datasetClientJson, localRecords) {
    if (err) {
      debug('Failed to doReadDatasetClientWithRecords due to error %j :: datasetClientId = %s', err, datasetClientId);
      return callback(err);
    }
    if (datasetClientJson) {
      datasetClientJson.records = localRecords;
    }
    return callback(null, datasetClientJson);
  });
}

function buildDatasetClientRecordsCachkey(datasetClientId) {
  return ['fhsync', datasetClientId, "records"].join(':');
}

function doReadDatasetClientWithRecordsUseCache(datasetClientId, callback) {
  //we are only cache the dataset records per dataset client here. 
  //This will not work very well if there are a lot of records are shared between different datasetClients as some of them will get stalled data.
  //That's why the caching is turned off by default. If can be enabled if there are no records shared between different datasetClients.
  //However, if in the future we need to add caching properly, we can implement different cache strategies.
  //For example, `perdatasetclient` = save the records in cache for each dataset client (current implementation), or
  // 'perdataset' = save the records per dataset. If any one of the datasetClient is updated, all the those datasetClients's caches should be invalidated as well.
  //Developers can then choose which cache strategy to use based on their requirements.
  var cacheKey = buildDatasetClientRecordsCachkey(datasetClientId);
  cacheClient.get(cacheKey, function(err, cachedData){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, ' error', ' Failed to read cache from redis with key ' + cacheKey + ' due to error ' + util.inspect(err));
    }
    if (cachedData) {
      return callback(null, JSON.parse(cachedData));
    } else {
      doReadDatasetClientWithRecords(datasetClientId, function(err, results){
        if (err) {
          return callback(err);
        }
        cacheClient.set(cacheKey, JSON.stringify(results));
        return callback(null, results);
      });
    }
  });
}

/**
 * Read the dataset client from db
 * @param {String} datasetClientId the id of the datasetClient
 * @param {Function} cb
 */
function doReadDatasetClient(datasetClientId, cb) {
  debug('doReadDatasetClient datasetClientId = %s', datasetClientId);
  var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  col.findOne({id: datasetClientId}, function(err, datasetClient) {
    if (err) {
      debug('Failed to read datasetClient due to error %j :: datasetClientId = %s', err, datasetClientId);
    }
    return cb(err, datasetClient);
  });
}


/**
 * The dataset client record object
 * @typedef {Object} storage~DatasetClientRecord
 * @property {String} uid - the uid of the record
 * @property {String} hash - the hash value of the data field of the record
 * @property {Object} data - the actual data of the record
 */

/**
 * Get the name of the dataset records collection.
 * @param {String} datasetId the id of the dataset
 * @returns {String} the record collection name. It should be like `fhsync-<datasetId>-records`.
 */
function getDatasetRecordsCollectionName(datasetId) {
  return ['fhsync', datasetId, "records"].join("_");
}


/**
 * Update the dataset client
 * @param {String} datasetClientId the datasetClient id
 * @param {storage~DatasetClient} fields the fields that need to be updated
 * @param {Boolean} upsert if true, the record will be created if can't be found
 * @param {Function} cb
 */
function doUpdateDatasetClient(datasetClientId, fields, upsert, cb) {
  debug('doUpdateDatasetClient datasetClientId = %s :: fields = %j', datasetClientId, fields);
  var col = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  delete fields._id;
  col.findOneAndUpdate({id: datasetClientId}, {'$set': fields}, {upsert: upsert, returnOriginal: false}, function(err, result) {
    if (err) {
      debug('Failed to update datasetClients due to error %j :: datasetClientId = %s :: fields = %j',err,datasetClientId,fields);
      return cb(err);
    }

    if (result.value === null) {
      return cb(new Error('DatasetClient not found for id ' + datasetClientId));
    }

    //ensure the indexes are create for a given dataset
    ensureIndexesForDataset(result.value.datasetId);
    return cb(null, result.value);
  });
}

/**
 * Create an index on the given collection
 * @param {String} collectionName
 * @param {Object} indexField see mongodb indexes
 * @param {Object} indexOpts see mongodb indexes options
 */
function createIndexForCollection(collectionName, indexField, indexOpts) {
  var collection = mongoClient.collection(collectionName);
  collection.createIndex(indexField, indexOpts, function(err) {
    if (err) {
      debug('Failed to create index for collection. collection = %s :: index = %j :: error = %j',collectionName,indexField,err);
    } else {
      debug('Index created for collection. Collection = %s  :: index = %s',collectionName,indexField);
    }
  });
}

/**
 * Create all the indexes on the collections for a given dataset
 * @param {String} datasetId
 */
function ensureIndexesForDataset(datasetId) {
  createIndexForCollection(getDatasetRecordsCollectionName(datasetId), {'uid': 1}, {});
  createIndexForCollection(require('./sync-updates').getDatasetUpdatesCollectionName(datasetId), {'cuid': 1, 'hash': 1}, {});
}

/**
 * Compute the diff between the 2 objects based on the hash value
 * @param {Object} localRecords
 * @param {Object} newRecords
 * @returns an object that contains the diff
 */
function diffRecords(localRecords, newRecords) {
  var recordsDiff = {};
  _.each(newRecords, function(record, uid) {
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
  _.each(localRecords, function(record, uid) {
    if (!newRecords[uid]) {
      record.op = "delete";
      recordsDiff[uid] = record;
    }
  });
  return recordsDiff;
}

/**
 * Save datasetClient json object to the `fhsync-datasetClients` collection, as well as the associated records for the datasetClient to the `fhsync-<datasetId>-records` collection
 * @param {String} datasetClientId the id of the datasetClient
 * @param {storage~DatasetClient} fields the fields that need to be updated for the given datasetClient
 * @param {storage~DatasetClientRecord[]} records the array of records that needs to be saved to the `fhsync-<datasetId>-records` collection
 * @param {Function} callback
 */
function doUpdateDatasetClientWithRecords(datasetClientId, fields, records, callback) {
  debug('doUpdateDatasetClientWithRecords datasetClientId = %s :: records.length = %d', datasetClientId, records.length);
  async.waterfall([
    async.apply(doUpdateDatasetClient, datasetClientId, fields, false),
    function listRecords(datasetClientJson, next) {
      //we don't need to data field here as it will not be used
      listDatasetClientRecords(datasetClientJson, {uid: 1, hash: 1}, function(err, localRecords) {
        return next(err, datasetClientJson, localRecords);
      });
    },
    //to reduce the number of db operations, we try to compute only the records that need to be changed here.
    function diff(datasetClientJson, localRecords, next) {
      var recordsDiff = diffRecords(syncUtil.convertToObject(localRecords), syncUtil.convertToObject(records));
      return next(null, datasetClientJson, recordsDiff);
    },
    function updateRecords(datasetClientJson, recordsDiff, next) {
      var datasetId = datasetClientJson.datasetId;
      upsertOrDeleteDatasetRecords(datasetId, datasetClientId, recordsDiff, function(err) {
        return next(err, datasetClientJson);
      });
    },
    //make sure we only update the dataset client at the end of the operation. Will should cause the globalHash value to be changed for the datasetClient, which should trigger clients to sync again.
    function updateDatasetClient(datasetClientJson, next) {
      var recordUids = _.pluck(records, 'uid');
      fields.recordUids = recordUids;
      doUpdateDatasetClient(datasetClientId, fields, false, next);
    },
    function invalidateCache(updatedDatasetClient, next) {
      var cacheKey = buildDatasetClientRecordsCachkey(datasetClientId);
      cacheClient.del(cacheKey);
      return next(null, updatedDatasetClient);
    }
  ], function(err, updatedDatasetClient) {
    if (err) {
      debug('Failed to doUpdateDatasetClientWithRecords due to error %j :: datasetClientId = %s :: fields = %j', err, datasetClientId, fields);
    }
    return callback(err, updatedDatasetClient);
  });
}

function doUpdateManyDatasetClients(query, fields, callback) {
  debug('doUpdateManyDatasetClients query = %j :: fields = %j', query, fields);
  var datasetClientsCollection = mongoClient.collection(DATASETCLIENTS_COLLECTION);
  datasetClientsCollection.updateMany(query, {$set: fields}, function(err, result) {
    if (err) {
      debug('Failed to doUpdateManyDatasetClients due to error %j :: fields = %j', err, fields);
      return callback(err);
    }
    return callback(null, result);
  });
}

module.exports = function(mongoClientImpl, cacheClientImpl) {
  mongoClient = mongoClientImpl;
  cacheClient = cacheClientImpl;
  createIndexForCollection(DATASETCLIENTS_COLLECTION, {'id': 1}, {});
  createIndexForCollection(DATASETCLIENTS_COLLECTION, {'datasetId': 1}, {});

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
     * @param {storage~DatasetClient[]} datasetClientsToRemove
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
     * @param {storage~DatasetClient} fieldsToUpdate the fields to update
     * @param {Function} callback
     */
    updateDatasetClient: function(datasetClientId, fieldsToUpdate, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doUpdateDatasetClient)(datasetClientId, fieldsToUpdate, false, callback);
    },

    /**
     * Create the give dataset if it doesn't no exist, or update the existing one.
     * Should return the datasetClient instance in the callback
     * @param {String} datasetClientId the id of the datasetClient
     * @param {storage~DatasetClient} fields the fields to upsert
     * @param {Function} callback
     */
    upsertDatasetClient: function(datasetClientId, fields, callback) {
      fields.id = datasetClientId;
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doUpdateDatasetClient)(datasetClientId, fields, true, callback);
    },

    /**
     * update the given dataset client with the given records
     * @param {String} datasetClientId the id of the datasetClient
     * @param {storage~DatasetClient} fields the fields to update
     * @param {storage~DatasetClientRecord[]} records an array of records to save
     * @param {Function} callback
     */
    updateDatasetClientWithRecords: function(datasetClientId, fields, records, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doUpdateDatasetClientWithRecords)(datasetClientId, fields, records, callback);
    },

    readDatasetClient: function(datasetClientId, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doReadDatasetClient)(datasetClientId, callback);
    },

    updateManyDatasetClients: function(query, fields, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doUpdateManyDatasetClients)(query, fields, callback);
    },

    /**
     * Read the given datasetclient record, and its assoicated records
     * @param {String} datasetClientId
     * @param {Function} callback
     */
    readDatasetClientWithRecords: function(datasetClientId, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doReadDatasetClientWithRecordsUseCache)(datasetClientId, callback);
    }
  };
};

module.exports.getDatasetRecordsCollectionName = getDatasetRecordsCollectionName;
module.exports.DATASETCLIENTS_COLLECTION = DATASETCLIENTS_COLLECTION;