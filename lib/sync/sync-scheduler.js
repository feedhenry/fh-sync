var Redlock = require('redlock');
var syncUtil = require('./util');
var util = require('util');

function SyncScheduler(redisClient, options) {
  if (arguments.length < 2) throw new Error('SyncScheduler constructor requires 2 arguments');

  this.redisClient = redisClient;
  this.redlock = new Redlock([client], {
    retryCount: Infinity,
    retryDelay: timeBetweenChecks
  });
  this.datasetClientsCacheKey = 'sync:datasetClients' || options.datasetClientsCacheKey;
  this.syncSchedulerLockName = 'locks:sync:SyncScheduler' || options.syncSchedulerLockName;
  this.timeBetweenChecks = 500 || options.timeBetweenChecks;
  this.timeBeforeCrashAssumed = 20000 || options.timeBeforeCrashAssumed;
  this.syncClientTimeout = 15000 || options.syncClientTimeout;
  this.queueAddLimit = 5 || options.queueAddLimit;
};

SyncScheduler.prototype.checkDatasetsForSyncing = function(cb) {

  // TODO: Call out to mongo for dataset clients collection

  this.redisClient.lrange(this.datasetClientsCacheKey, 0, -1, function(err, datasetClients) {
    if (err) return cb(err);

    var datasetClientsToSync = [];
    var datasetClientsToRemove = [];

    for(var ci=0, cl = datasetClients.length; ci < cl; ci++) {
      var datasetClient = datasetClients[ci];

      // TODO: check the syncQueue to see if a sync is already scheduled

      // TODO: ensure syncRunning is set (or a lock is set) in the sync worker for
      //       dataset client that is currently being synced

      if (!datasetClient.syncRunning) {
        // Check to see if it is time for the sync loop to run again
        var lastSyncStart = datasetClient.syncLoopStart;
        var lastSyncCmp = datasetClient.syncLoopEnd;
        if (lastSyncStart === null) {
          syncUtil.doLog(dataset_id, 'verbose', 'Scheduling initial sync');
          // Dataset has never been synced before - do initial sync
          datasetClientsToSync.push(datasetClient);
        } else if (lastSyncCmp !== null) {
          // Check to see if this sync needs to be deactivated because
          // of lack of active clients.
          var timeSinceLastSync = new Date().getTime() - lastSyncCmp;
          var lastAccessed = datasetClient.lastAccessed;
          var syncClientTimeout = dataset.config.clientSyncTimeout * 1000;
          var now = new Date().getTime();
          if (lastAccessed + this.syncClientTimeout < now) {
            syncUtil.doLog(dataset_id, 'info', 'Deactivating sync for client ' + datasetClient.id + '. No client instances have accessed in ' + syncClientTimeout + 'ms');
            datasetClientsToRemove.push(datasetClient);
          }
          else {
            var syncFrequency = dataset.config.syncFrequency * 1000;
            if (timeSinceLastSync > syncFrequency) {
              // Time between sync loops has passed - do another sync
              syncUtil.doLog(dataset_id, 'verbose', 'Scheduling sync due to elapsed time');
              datasetClientsToSync.push(datasetClient);
            }
          }
        }
      }
    }

    async.series([function addDatasetClientsToSyncQueue(wcb) {
      async.eachLimit(datasetClientsToSync, this.queueAddLimit, function(datasetClient, cb) {
        syncQueue.add(datasetClient, function(err, callback) {
          // if there's a problem, log it and continue.
          // There's nothing we can or should do as it may be an intermittent problem
          if (err) syncUtil.doLog(datasetClient.datasetId, 'error', 'Error adding datasetClient to sync queue (' + util.inspect(err) + ')');
          return callback();
        });
      }, wcb);
    }, function removeDatasetClientsFromSyncList(wcb) {

        // TODO remove each of datasetClientsToRemove from the datasetClients collection in mongodb

        return wcb();
    }], cb);
  });
};

SyncScheduler.prototype.start = function() {
  var self = this;

  // TODO Use mongodb for locking via https://github.com/chilts/mongodb-lock

  // TODO when using https://github.com/chilts/mongodb-lock, ensure old locks are removed

  this.redlock.lock(syncSchedulerLockName, timeBeforeCrashAssumed).then(function(lock) {
    syncUtil.doLog(syncUtil.SYNC_LOGGER, 'verbose', 'Got redlock for ' + syncSchedulerLockName);

    self.checkDatasetsForSyncing(function(err) {
      if (err) {
        // Any error may be intermittent, so log it and continue as normal
        syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Error checking datasets for syncing ' + util.inspect(err));
      }
      // release the lock after the configured time between checks,
      // then start trying to get the lock again
      lock.extend(timeBetweenChecks).then(function() {
        return self.start();
      });
    });
  }).catch(function(err){
    // if something goes wrong, log it and try to get a lock again, but wait for minimum time
    syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Error getting redlock for ' + syncSchedulerLockName + ' ' + util.inspect(err));
    setTimeout(function() {
      self.start();
    }, timeBetweenChecks);
  });
};

module.exports = {
  SyncScheduler: SyncScheduler
};