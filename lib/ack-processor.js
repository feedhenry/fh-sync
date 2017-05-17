var syncUtil = require('./util');
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;

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
    debugError("acknowledgement missing info %j", acknowledgement);
    return callback();
  }
  debug('processAcknowledge :: processing acknowledge %j', acknowledgement);
  syncStorage.findAndDeleteUpdate(datasetId, acknowledgement, function(err) {
    if (err) {
      debugError('END processAcknowledge - err=%s', err);
      return callback(err);
    } else {
      debug('acknowledgement processed successfully. hash = %s', acknowledgement.hash);
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
