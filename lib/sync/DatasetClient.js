var syncUtil = require('./util');
var datasets = require('./datasets');
var debug = syncUtil.debug;

function generateDatasetClientId(datasetClient) {
  return [datasetClient.datasetId, syncUtil.generateHash(datasetClient.queryParams)].join("_");
}

/**
 * Represent a dataset client that is managed by sync framework.
 * @param {String} datasetId the id of the dataset
 * @param {Object} opts options of the dataset client
 * @param {Object} opts.queryParams the query parameters of the dataset client. Will be passed to the data handler to list data.
 * @param {Object} opts.metaData the meta data of the dataset client. Will be passed to the data handler to list data.
 * @param {Object} opts.config the configuration option of the dataset client
 */
function DatasetClient(datasetId, opts){
  opts = opts || {};
  this.datasetId = datasetId;
  this.queryParams = opts.queryParams || {};
  this.metaData = opts.metaData || {};
  this.id = generateDatasetClientId(this);
  this.config = opts.config || datasets.getDatasetConfig(datasetId);
  this.collisionCount = opts.collisionCount || 0;
  this.stopped = opts.stopped;
  this.syncScheduled = opts.syncScheduled;
  this.syncCompleted = opts.syncCompleted;
  this.syncLoopStart = opts.syncLoopStart;
  this.syncLoopEnd = opts.syncLoopEnd;
  this.lastAccessed = opts.lastAccessed;
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
    collisionCount: this.collisionCount,
    globalHash: this.globalHash,
    stopped: this.stopped,
    syncScheduled : this.syncScheduled,
    syncCompleted : this.syncCompleted,
    syncLoopStart : this.syncLoopStart,
    syncLoopEnd : this.syncLoopEnd,
    lastAccessed : this.lastAccessed
  };
};

/**
 * Check if the dataset client should be synced.
 */
DatasetClient.prototype.shouldSync = function() {
  var self = this;
  if (self.stopped === true) {
    return false;
  }

  //this will make sure the syncScheduled field won't cause the dataset client not to be synced anymore.
  //This could happen if the syncScheduled is set on the datasetClient, but then the process is crashed before the sync requests are put on the queue (see checkDatasetsForSyncing in sync-scheduler.js). 
  //The syncScheduled field will only take into consideration if it's within reasonable past.
  if (self.syncScheduled) {
    var sinceLastScheduled = Date.now() - self.syncScheduled;
    var maxWaitTIme = (self.config.maxScheduleWaitTime || (self.config.syncFrequency + self.config.backendListTimeout)) * 1000;
    if (sinceLastScheduled < maxWaitTIme) {
      debug('skip scheduling for datasetClient %s as it is scheduled already', self.id);
      return false;
    }
  }

  if (!self.syncLoopStart) {
    // Dataset has never been synced before - do initial sync
    return true;
  }
  // Time between sync loops has passed - do another sync
  var lastSyncCmp = self.syncLoopEnd;
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
  if (!self.syncLoopStart || !self.syncLoopEnd) {
    return false;
  }
  // Check to see if this sync needs to be deactivated because
  // of lack of active clients.
  var lastAccessed = self.lastAccessed;
  var syncClientTimeout = self.config.clientSyncTimeout * 1000;
  var now = Date.now();
  return lastAccessed + syncClientTimeout < now
};

/**
 * Check if the dataset client should be removed.
 */
DatasetClient.prototype.shouldBeRemoved = function(retentionTime) {
  if (this.lastAccessed) {
    //only inactive datasetClients can be removed
    return (this.lastAccessed + this.config.clientSyncTimeout * 1000 + retentionTime) < Date.now();
  } else {
    return false;
  }
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
  return this.config;
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