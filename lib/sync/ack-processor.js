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
  var datasetId = acknowledgement.datasetId;
  if (!datasetId || !acknowledgement.cuid || !acknowledgement.hash) {
    syncUtil.doLog(syncUtil.SYNC_LOGGER, "debug", "acknowledgement missing info " + util.inspect(acknowledgement));
    return callback();
  }
  syncUtil.doLog(datasetId, 'debug', 'processAcknowledge :: processing acknowledge ' + util.inspect(acknowledgement));
  syncStorage.findAndDeleteUpdate(datasetId, acknowledgement, function(err){
    if (err) {
      syncUtil.doLog(datasetId, 'error', 'END processAcknowledge - err=' + util.inspect(err));
      return callback(err);
    } else {
      syncUtil.doLog(datasetId, 'debug', 'acknowledgement processed successfully. hash = ' + acknowledgement.hash);
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
