var _ = require('underscore');
var async = require('async');
var syncUtil = require('./util');
var DatasetClient = require('./DatasetClient');
var metrics = require('./sync-metrics');
var debug = syncUtil.debug;
var debugError = syncUtil.debugError;
var metricsClient;
var syncStorage;
var syncLock;

/**
 * A scheduled job that will run to check the status of the datasets that are managed by the sync framework.
 * @param {MongodbQueue} syncQueueImpl an instance of the MongodbQueue that is used to push sync requests
 * @param {Object} options the configuration options for the scheduler
 * @param {String} options.syncSchedulerLockName the name of the sync scheduler lock. Default: "locks:sync:SyncScheduler".
 * @param {Number} options.timeBetweenChecks an interval that decides how often the scheduler should be running. In milliseconds. Default: 500.
 * @param {Number} options.timeBeforeCrashAssumed a value that decides how long the lock should be accquired for. In milliseconds. Default: 20000.
 */
function SyncScheduler(syncQueueImpl, options) {
  if (!syncQueueImpl) {
    throw new Error('syncQueueImpl is required');
  }
  this.syncQueue = syncQueueImpl;
  options = options || {};
  this.syncSchedulerLockName = options.syncSchedulerLockName || 'locks:sync:SyncScheduler';
  this.timeBetweenChecks = options.timeBetweenChecks || 500;
  this.timeBeforeCrashAssumed = options.timeBeforeCrashAssumed || 20000;
  this.stopped = false;
}

/**
 * Loop through all the dataset clients and see if any of them is due to sync with the backend, or if the dataset is not active anymore and should be removed.
 * @param {Function} cb the callback function
 */
SyncScheduler.prototype.checkDatasetsForSyncing = function(cb) {
  var self = this;
  var timer = metrics.startTimer();
  syncStorage.listDatasetClients({active: true}, function(err, datasetClients) {
    if (err) {
      metricsClient.gauge(metrics.KEYS.SYNC_SCHEDULER_CHECK_TIME, {success: false}, timer.stop());
      return cb(err);
    }

    debug('[%s] sync scheduler checking %d active datasetClients', datasetClients.length);

    var datasetClientsToSync = [];
    var inactiveDatasetClientIds = [];

    _.each(datasetClients, function(datasetClientJson) {
      var datasetClient = DatasetClient.fromJSON(datasetClientJson);
      var datasetId = datasetClient.getDatasetId();
      if (datasetClient.shouldDeactiveSync()) {
        //if the a datasetclient is not active, we don't need to sync it
        debug('[%s] Ignoring inactive dataset client. No client instances have accessed in over %d ms', datasetId, datasetClient.getConfig().clientSyncTimeout * 1000);
        inactiveDatasetClientIds.push(datasetClient.getId());
      } else if (datasetClient.shouldSync()) {
        debug('[%s] schedule sync run for datasetClient %s', datasetId, datasetClient.id);
        var syncRequest = datasetClient.toJSON();
        //record the start time to allow us measure the overall time it takes to process a sync request
        syncRequest.startTime = Date.now();
        datasetClientsToSync.push(syncRequest);
      }
    });

    async.series([
        //make sure each dataset client is marked to be scheduled
        function updateDatasetClients(wcb) {
          var datasetClientIds = _.pluck(datasetClientsToSync, 'id');
          syncStorage.updateManyDatasetClients({id: {$in: datasetClientIds}}, {syncScheduled: Date.now()}, wcb);
        },
        function deactiveDatasetClients(wcb) {
          syncStorage.updateManyDatasetClients({id: {$in: inactiveDatasetClientIds}}, {active: false}, wcb);
        },
        function addDatasetClientsToSyncQueue(wcb) {
          self.syncQueue.addMany(datasetClientsToSync, function(err) {
            // if there's a problem, log it and continue.
            // There's nothing we can or should do as it may be an intermittent problem
            if (err) {
              debugError('Error adding datasetClients to sync queue (%s)', err);
            }
            return wcb();
          });
        }
      ],
      function() {
        metricsClient.gauge(metrics.KEYS.SYNC_SCHEDULER_CHECK_TIME, {success: true}, timer.stop());
        return cb();
      });
  });
};

function tryNext(target, lockCode) {
  setTimeout(function() {
    if (!target.stopped) {
      if (lockCode) {
        debug('release lock %s', target.syncSchedulerLockName);
        syncLock.release(target.syncSchedulerLockName, lockCode, function(err) {
          if (err) {
            //if failed, log the error. The lock will be release evetually when `timeBeforeCrashAssumed` is reached.
            debugError('Failed to release lock due to error (%s)', err);
          }
          target.start();
        });
      } else {
        target.start();
      }
    }
  }, target.timeBetweenChecks);
}

/**
 * Start to run the scheduler.
 */
SyncScheduler.prototype.start = function() {
  var self = this;
  //we only want one of the workers can become a scheduler
  syncLock.acquire(self.syncSchedulerLockName, self.timeBeforeCrashAssumed, function(err, lockCode) {
    if (err) {
      debugError('Failed to accquire lock for key %s error = %s', self.syncSchedulerLockName, err);
      tryNext(self);
    } else if (lockCode) {
      debug('Got lock for %s :: lock = %s', self.syncSchedulerLockName, lockCode);
      self.checkDatasetsForSyncing(function(err) {
        if (err) {
          // Any error may be intermittent, so log it and continue as normal
          debug('Error checking datasets for syncing %s', err);
        }
        tryNext(self, lockCode);
      });
    } else {
      debug('no lock acquired %s', self.syncSchedulerLockName);
      //no lock, try again
      tryNext(self);
    }
  });
};

SyncScheduler.prototype.stop = function(cb) {
  this.stopped = true;
  return cb && cb();
}

module.exports = function(syncLockImpl, syncStorageImpl, metricsClientImpl) {
  syncLock = syncLockImpl;
  syncStorage = syncStorageImpl;
  metricsClient = metricsClientImpl;
  return {
    SyncScheduler: SyncScheduler
  };
};
