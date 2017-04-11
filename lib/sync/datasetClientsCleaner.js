var parseDuration = require('parse-duration');
var async = require('async');
var _ = require('underscore');
var DatasetClient = require('./DatasetClient');
var syncUtil = require('./util');
var debug = syncUtil.debug;

var storage;

/**
 * Constructor for DatasetClientsCleaner.
 *
 * A DatasetClientsCleaner will check the status of all the dataset clients in the db, and if any of them hasn't been accessed for the past <retentionPeriod> time, it will remove them from the db to save space.
 * By default, it will remove dataset clients that haven't been active for 1 day and it will run the check every hour.
 * Developer can change those parameters via the configuration.
 *
 * @param {Object} opts configuration options for the DatasetClientsCleaner.
 * @param {String} retentionPeriod the maximum time the dataset client can be kept in db after it's last access tim. Support format: https://www.npmjs.com/package/parse-duration. Default is '24h'.
 * @param {String} checkFrequency how often the checks should be running. Default is '1h'.
 */
function DatasetClientsCleaner(opts) {
  this.retentionPeriod = opts.retentionPeriod || '24h';
  this.checkFrequency = opts.checkFrequency || '1h';
  this.job;
}

function cleanDatasetClients(retentionPeriod) {
  var parsedTime = parseDuration(retentionPeriod);
  async.waterfall([
    async.apply(storage.listDatasetClients),
    function filterDatasetClients(datasetClients, callback) {
      var datasetClientsToRemove = _.filter(datasetClients, function(datasetClientJson) {
        var datasetClient = DatasetClient.fromJSON(datasetClientJson);
        return datasetClient.shouldBeRemoved(parsedTime);
      });
      return callback(null, datasetClientsToRemove);
    },
    async.apply(storage.removeDatasetClients)
  ], function(err, deletedDatasetClients) {
    if (err) {
      debug('Failed to cleanup dataset clients due to error %j', err);
    } else {
      debug('Removed %d dataset clients',_.size(deletedDatasetClients));
    }
  });
}

/**
 * Start running the cleanup job for dataset clients
 */
DatasetClientsCleaner.prototype.start = function(immediately, cb) {
  var self = this;
  if (immediately) {
    cleanDatasetClients(self.retentionPeriod);
  }
  if (!this.job) {
    this.job = setInterval(function() {
      cleanDatasetClients(self.retentionPeriod);
    }, parseDuration(self.checkFrequency));
  }
  return cb && cb();
};

/**
 * Stop the job
 */
DatasetClientsCleaner.prototype.stop = function(cb) {
  if (this.job) {
    clearInterval(this.job);
  }
  return cb && cb();
};

module.exports = function(storageImpl) {
  storage = storageImpl;
  return function(opts) {
    return new DatasetClientsCleaner(opts);
  }
};