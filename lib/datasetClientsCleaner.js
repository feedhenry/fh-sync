var parseDuration = require('parse-duration');
var async = require('async');
var _ = require('underscore');
var DatasetClient = require('./DatasetClient');
var syncUtil = require('./util');
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;

var syncLock;
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
  this.cleanerLockName = opts.cleanerLockName || 'locks:sync:DatasetCleaner';
  this.lockTimeout = parseDuration(this.checkFrequency) / 2;
  this.job;
}

function cleanDatasetClients(retentionPeriod, lockName, lockTimeout) {
  syncLock.acquire(lockName, lockTimeout, function(err, lockCode){
    if (err) {
      debugError('Failed to acquire lock for key = %s : error = %s', lockName, err);
    } else if(lockCode) {
      debug('lock acquired for datasetClientCleaner code = %s. Start cleaning', lockCode);
      var parsedTime = parseDuration(retentionPeriod);
      async.waterfall([
        async.apply(storage.listDatasetClients, {active: false}),
        function filterDatasetClients(datasetClients, callback) {
          var datasetClientsToRemove = _.filter(datasetClients, function(datasetClientJson) {
            var datasetClient = DatasetClient.fromJSON(datasetClientJson);
            return datasetClient.shouldBeRemoved(parsedTime);
          });
          return callback(null, datasetClientsToRemove);
        },
        async.apply(storage.removeDatasetClients)
      ], function(err, deletedDatasetClients) {
        syncLock.release(lockName, lockCode, function(unlockErr){
          if (unlockErr) {
            debugError('Failed to release lock due to error %s', unlockErr);
          }
        });
        if (err) {
          debugError('Failed to cleanup dataset clients due to error %s', err);
        } else {
          debug('Removed %d dataset clients',_.size(deletedDatasetClients));
        }
      });
    } else {
      debug('no lock acquired. Wait for the next one');
    }
  });
}

/**
 * Start running the cleanup job for dataset clients
 */
DatasetClientsCleaner.prototype.start = function(immediately, cb) {
  var self = this;
  if (immediately) {
    cleanDatasetClients(self.retentionPeriod, self.cleanerLockName, self.lockTimeout);
  }
  if (!this.job) {
    this.job = setInterval(function() {
      cleanDatasetClients(self.retentionPeriod, self.cleanerLockName, self.lockTimeout);
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

module.exports = function(storageImpl, syncLockImpl) {
  storage = storageImpl;
  syncLock = syncLockImpl;
  return function(opts) {
    return new DatasetClientsCleaner(opts);
  }
};