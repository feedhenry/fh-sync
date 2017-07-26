var syncUtil = require('../util');
var metrics = require('../sync-metrics');
var debug=syncUtil.debug;
var debugError = syncUtil.debugError;
var mongoClient;

/**
 * The acknowledgement object
 * @typedef {Object} storage~Acknowledgement
 * @property {String} type - if this updates has been applied successfully. Possible values: applied, failed and collisions.
 * @property {String} cuid - the unique client id that submitted that update
 * @property {String} action - the operation that the update is trying to perform. Possible values: create/update/delete
 * @property {String} hash - the hash value (can be considered as the unique id) of the update
 * @property {String} uid - the uid of the record the update is for
 * @property {String} msg - any message about the update. could be the error message if the update is failed
 * @property {Number} timestamp - when the update is applied
 */

/**
 * Find the delete the given sync update object from the `fhsync-<datasetId>-updates` collection
 * @param {String} datasetId
 * @param {storage~Acknowledgement} acknowledgement should at least have the `cuid` and `hash` fields
 * @param {Function} callback
 */
function doFindAndDeleteUpdate(datasetId, acknowledgement, callback) {
  debug('[%s] doFindAndDeleteUpdate acknowledgement = %j',datasetId,acknowledgement);
  var updatesCollection = mongoClient.collection(getDatasetUpdatesCollectionName(datasetId));
  updatesCollection.findOneAndDelete({cuid: acknowledgement.cuid, hash: acknowledgement.hash}, function(err, result) {
    if (err) {
      debugError('[%s] Failed to doFindAndDeleteUpdate due to error %s :: acknowledgement = %j',datasetId,err,acknowledgement);
      return callback(err);
    }
    return callback(null, result.value);
  });
}

/**
 * Save the sync update to the `fhsync-<datasetId>-updates` collection
 *
 * @param {String} datasetId
 * @param {storage~Acknowledgement} acknowledgementFields
 * @param {Function} callback
 */
function doSaveUpdate(datasetId, acknowledgementFields, callback) {
  debug('[%s] doSaveUpdate acknowledgementFields = %j' , datasetId, acknowledgementFields);
  var updatesCollection = mongoClient.collection(getDatasetUpdatesCollectionName(datasetId));
  updatesCollection.findOneAndUpdate({cuid: acknowledgementFields.cuid, hash: acknowledgementFields.hash}, {'$set': acknowledgementFields}, {upsert: true, returnOriginal: false}, function(err, updateResult) {
    if (err) {
      debugError('[%s] Failed to doSaveUpdate due to error %s :: acknowledgementFields = %j' ,datasetId,err,acknowledgementFields);
      return callback(err);
    }
    return callback(null, updateResult.value);
  });
}

/**
 * List all the updates that match the given search criteria
 *
 * @param {String} datasetId
 * @param {Object} criteria
 * @param {Object} options
 * @param {Function} callback
 */
function doListUpdates(datasetId, criteria, options, callback) {
  debug('[%s] doListUpdates criteria = %j',datasetId,criteria);
  var updatesCollection = mongoClient.collection(getDatasetUpdatesCollectionName(datasetId));
  var docLimit = options && options.limit;
  var cursor = updatesCollection.find(criteria);
  if (docLimit && docLimit > 0) {
    cursor = cursor.limit(docLimit);
  }
  cursor.toArray(function(err, updates) {
    if (err) {
      debugError('[%s] Failed to doListUpdates due to error %s :: criteria = %j' + criteria,datasetId,err,criteria);
      return callback(err);
    }
    return callback(null, updates);
  });
}

module.exports = function(mongoClientImpl) {
  mongoClient = mongoClientImpl;
  return {
    /**
     * find the delete the given sync update
     * @param {String} datasetId
     * @param {storage~Acknowledgement} acknowledgement
     * @param {Function} callback
     */
    findAndDeleteUpdate: function(datasetId, acknowledgement, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doFindAndDeleteUpdate)(datasetId, acknowledgement, callback);
    },

    /**
     * Save the given sync update
     * @param {String} datasetId
     * @param {storage~Acknowledgement} acknowledgementFields
     * @param {Function} callback
     */
    saveUpdate: function(datasetId, acknowledgementFields, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doSaveUpdate)(datasetId, acknowledgementFields, callback);
    },

    /**
     * List the updates that match the given list criteria
     * @param {String} datasetId
     * @param {Object} criteria the list criteria, a mongodb query object
     * @param {Object} options options for the find option, like `limit`
     * @param {Function} callback
     */
    listUpdates: function(datasetId, criteria, options, callback) {
      return metrics.timeAsyncFunc(metrics.KEYS.MONGODB_OPERATION_TIME, doListUpdates)(datasetId, criteria, options, callback);
    }
  };
};


/**
 * Get the collection name of the updates team
 * @param {String} datasetId
 * @returns the name of the updates collection
 */
function getDatasetUpdatesCollectionName(datasetId) {
  return ['fhsync', datasetId, 'updates'].join('_');
}

module.exports.getDatasetUpdatesCollectionName = getDatasetUpdatesCollectionName;