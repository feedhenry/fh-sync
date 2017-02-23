var syncUtil = require('./util');
var datasets = require('./datasets');

function generateDatasetClientId(datasetClient) {
  return [datasetClient.datasetId, syncUtil.generateHash(datasetClient.queryParams), syncUtil.generateHash(datasetClient.metaData)].join("_");
}

/**
 * Represent a dataset client that is managed by sync framework.
 * @param {String} datasetId the id of the dataset
 * @param {Object} opts options of the dataset client
 * @param {Object} opts.queryParams the query parameters of the dataset client. Will be passed to the data handler to list data.
 * @param {Object} opts.metaData the meta data of the dataset client. Will be passed to the data handler to list data.
 * @param {Object} opts.props some properties of the dataset client. Mainly for record the internal status of the dataset client
 * @param {Object} opts.config the configuration option of the dataset client
 */
function DatasetClient(datasetId, opts){
  opts = opts || {};
  this.datasetId = datasetId;
  this.queryParams = opts.queryParams || {};
  this.metaData = opts.metaData || {};
  this.props = opts.props || {};
  this.id = generateDatasetClientId(this);
  this.config = opts.config || datasets.getDatasetConfig(datasetId);
}

/**
 * Get the JSON presentation of the dataset client instance.
 */
DatasetClient.prototype.toJSON = function() {
  return {
    id: this.id,
    datasetId: this.datasetId,
    queryParams: this.queryParams,
    metaData: this.metaData,
    config: this.config,
    props: this.props,
    globalHash: this.globalHash
  };
};

/**
 * Check if the dataset client should be synced.
 */
DatasetClient.prototype.shouldSync = function() {
  var self = this;
  if (!self.props.syncLoopStart) {
    // Dataset has never been synced before - do initial sync
    return true;
  }
  // Time between sync loops has passed - do another sync
  var lastSyncCmp = self.props.syncLoopEnd;
  if (!lastSyncCmp) {
    //the sync run hasn't been finished before, can't decide
    return false;
  }
  var syncFrequency = self.config.syncFrequency * 1000;
  var timeSinceLastSync = Date.now() - lastSyncCmp;
  return timeSinceLastSync >= syncFrequency;
};

/**
 * Check if the dataset client should be deactivated.
 */
DatasetClient.prototype.shouldDeactiveSync = function() {
  var self = this;
  if (!self.props.syncLoopStart || !self.props.syncLoopEnd) {
    return false;
  }
  // Check to see if this sync needs to be deactivated because
  // of lack of active clients.
  var lastAccessed = self.props.lastAccessed;
  var syncClientTimeout = self.config.clientSyncTimeout * 1000;
  var now = Date.now();
  return lastAccessed + syncClientTimeout < now
};

/**
 * Get the dataset id.
 */
DatasetClient.prototype.getDatasetId = function() {
  return this.datasetId;
};

/**
 * Get the dataset client id
 */
DatasetClient.prototype.getId = function() {
  return this.id;
}

/**
 * Get the current configuration object. Return an immutable object
 */
DatasetClient.prototype.getConfig = function() {
  return Object.freeze(this.config);
};

/**
 * Set the global hash value of the dataset client
 */
DatasetClient.prototype.setGlobalHash = function(globalHash) {
  this.globalHash = globalHash
};

/**
 * Get an instance of DatasetClient from the given JSON object.
 * @param {Object} json the JSON object
 */
DatasetClient.fromJSON = function(json) {
  return new DatasetClient(json.datasetId, json);
};

module.exports = DatasetClient;