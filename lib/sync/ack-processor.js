var util = require('util');
var syncUtil = require('./util');

var syncStorage;

/**
 * Process a single acknowledgement. It will find the acknowledgement in the <datasetId>-updates collection and remove it.
 * @param {Object} acknowledgement represent the result of a sync update operation
 * @param {String} acknowledgement.datasetId the dataset id
 * @param {String} acknowledgement.cuid the unique client id
 * @param {String} acknowledgement.hash the hash value of the acknowledgement
 * @param {any} callback
 */
function processAcknowledgement(acknowledgement, callback) {
  var dataset_id = acknowledgement.datasetId;
  if (!dataset_id || !acknowledgement.cuid || !acknowledgement.hash) {
    syncUtil.doLog(syncUtil.SYNC_LOGGER, "error", "acknowledgement missing info " + util.inspect(acknowledgement));
    return callback();
  }
  syncUtil.doLog(dataset_id, 'verbose', 'processAcknowledge :: processing update ' + util.inspect(acknowledgement));
  syncStorage.findAndDeleteUpdate(dataset_id, acknowledgement, function(err){
    if (err) {
      syncUtil.doLog(dataset_id, 'info', 'END processAcknowledge - err=' + util.inspect(err));
      return callback(err);
    } else {
      return callback();
    }
  });
}

module.exports = function(syncStorageImpl) {
  syncStorage = syncStorageImpl;
  return function(ackRequest, callback) {
    var ackPayload = ackRequest.payload;
    return processAcknowledgement(ackPayload, callback);
  }
};