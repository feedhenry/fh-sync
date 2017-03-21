var _ = require('underscore');
var datasetClients = require('./dataset-clients');
var datasetUpdates = require('./sync-updates');

module.exports = function(mongoClientImpl) {
  var api = {};
  _.extend(api,
    datasetClients(mongoClientImpl),
    datasetUpdates(mongoClientImpl)
  );
  return api;
};


module.exports.DATASETCLIENTS_COLLECTION = datasetClients.DATASETCLIENTS_COLLECTION;
module.exports.getDatasetRecordsCollectionName = datasetClients.getDatasetRecordsCollectionName;
module.exports.getDatasetUpdatesCollectionName = datasetUpdates.getDatasetUpdatesCollectionName;