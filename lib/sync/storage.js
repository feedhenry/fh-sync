
var redisClient = null;

module.exports = function(redisClientImpl) {
  redisClient = redisClientImpl;
  return {
    /**
     * @param datasetId
     * @param globalHash
     * @param recordsWithHash
     * @param syncInfo
     * @param callback
     */
    saveLastSyncDataset: function() {
      //TODO: implement this function
    }
  };
};