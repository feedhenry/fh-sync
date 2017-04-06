var _ = require('underscore');

var DEFAULT_CONFIG = {
  //how often the dataset client should be sync with the backend. In seconds.
  syncFrequency: 30,
  //a value that will be used to decide if the dataset client is not active anymore.
  //if the gap between the current time and the last access time of the dataset client is bigger than this value, 
  //the dataset client is deemed to be inactive.
  clientSyncTimeout: 60*60,
  //a value that determins how long it should wait for the backend list operation to complete
  backendListTimeout: 60*5
};

function Dataset(datasetId, opts) {
  this.id = datasetId;
  this.config = _.extend({}, DEFAULT_CONFIG, opts || {});
}

Dataset.prototype.getConfig = function() {
  return Object.freeze(this.config);
};

var datasets = {};

function init(datasetId, options) {
  datasets[datasetId] = new Dataset(datasetId, options);
}

function getDataset(datasetId) {
  if (!datasets[datasetId]) {
    init(datasetId);
  }
  return datasets[datasetId];
}

module.exports = {
  init: init,

  getDataset: getDataset,

  getDatasetConfig: function(datasetId) {
    return getDataset(datasetId).getConfig();
  }
};