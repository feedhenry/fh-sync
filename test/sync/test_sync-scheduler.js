var assert = require('assert');
var sinon = require('sinon');
var syncSchedulerModule = require('../../lib/sync/sync-scheduler');

var lockProvider = {
  acquire: sinon.stub(),
  release: sinon.stub()
};
var lock = {
  release: sinon.stub()
};

var syncStorage = {
  listDatasetClients: sinon.stub(),
  removeDatasetClients: sinon.stub(),
  updateDatasetClient: sinon.stub()
};

var metricsClient = {
  gauge: sinon.stub()
};

function testNoLock(done) {
  var SyncScheduler = syncSchedulerModule(lockProvider, syncStorage, metricsClient).SyncScheduler;
  var syncQueue = {
    addMany: sinon.stub()
  };
  syncStorage.listDatasetClients.reset();
  var scheduler = new SyncScheduler(syncQueue, {timeBetweenChecks: 100});
  scheduler.start();
  setTimeout(function(){
    assert.equal(syncStorage.listDatasetClients.callCount, 0);
    assert.ok(lockProvider.acquire.callCount >= 2);
    done();
  }, 200);
}

module.exports = {
  'test create arg validation': function() {
    var SyncScheduler = syncSchedulerModule().SyncScheduler;
    var scheduler = null;

    assert.throws(function() {
      sheduler = new SyncScheduler();
    }, function(err) {
      assert.equal(err.message, 'syncQueueImpl is required');
      return true;
    });
  },

  'test sync scheduler run successfully': function(done) {
    var SyncScheduler = syncSchedulerModule(lockProvider, syncStorage, metricsClient).SyncScheduler;
    var syncQueue = {
      addMany: sinon.stub()
    };

    lockProvider.acquire.yieldsAsync(null, lock);
    lockProvider.release.yieldsAsync();

    //the first dataset client is due to sync, and the second dataset client should be deactivated
    var datasetClients = [{
      datasetId: 'testDataset',
      queryParams: {"user": "user1"},
      metaData: {},
      config: {
        syncFrequency: 1
      },
      syncLoopStart: new Date().getTime() - 2000,
      syncLoopEnd: new Date().getTime() - 1001
    }, {
      datasetId: 'testDataset',
      queryParams: {"user": "user2"},
      metaData: {},
      config: {
        clientSyncTimeout: 1
      },
      syncLoopStart: new Date().getTime() - 2000,
      syncLoopEnd: new Date().getTime() - 1001,
      lastAccessed: new Date().getTime() - 1001
    }, {
      datasetId: 'testDataset',
      queryParams: {"user": "user3"},
      metaData: {},
      config: {
        clientSyncTimeout: 1
      },
      syncLoopStart: new Date().getTime() - 2000,
      syncLoopEnd: new Date().getTime() - 1001,
      syncScheduled: Date.now() - 200
    }];

    syncStorage.listDatasetClients.yieldsAsync(null, datasetClients);
    syncQueue.addMany.yieldsAsync();
    syncStorage.removeDatasetClients.yieldsAsync();
    syncStorage.updateDatasetClient.yieldsAsync();

    var scheduler = new SyncScheduler(syncQueue, {timeBetweenChecks: 2000}); //only run the sync loop once
    scheduler.start();
    setTimeout(function(){
      assert.ok(lockProvider.acquire.calledOnce);
      assert.ok(syncStorage.listDatasetClients.calledOnce);
      
      assert.ok(syncQueue.addMany.calledOnce);
      var datasetClientsToSync = syncQueue.addMany.args[0][0];
      assert.equal(datasetClientsToSync.length, 1);
      assert.equal(datasetClientsToSync[0].queryParams.user, "user1");

      assert.ok(syncStorage.updateDatasetClient.calledOnce);

      assert.ok(syncStorage.removeDatasetClients.calledOnce);
      var datasetClientsToRemove = syncStorage.removeDatasetClients.args[0][0];
      assert.equal(datasetClientsToRemove.length, 1);
      assert.equal(datasetClientsToRemove[0].queryParams.user, "user2");

      done();
    }, 1500);
  },

  'test the sync loop will run forever': function(done){
    var SyncScheduler = syncSchedulerModule(lockProvider, syncStorage, metricsClient).SyncScheduler;
    var syncQueue = {
      addMany: sinon.stub()
    };

    lockProvider.acquire.yieldsAsync(null, lock);
    lockProvider.release.yieldsAsync();
    var datasetClients = [];
    syncStorage.listDatasetClients.yieldsAsync(null, datasetClients);
    syncStorage.updateDatasetClient.yieldsAsync();
    syncQueue.addMany.yieldsAsync();
    syncStorage.removeDatasetClients.yieldsAsync();
    var scheduler = new SyncScheduler(syncQueue, {timeBetweenChecks: 100});
    scheduler.start();
    setTimeout(function(){
      assert.ok(lockProvider.acquire.callCount >= 5);
      done();
    }, 500);
  },

  'test sync loop with lock error': function(done) {
    lockProvider.acquire.reset();
    lockProvider.acquire.yieldsAsync(new Error('lock error'));
    testNoLock(done);
  },

  'test sync loop with no lock': function(done) {
    lockProvider.acquire.reset();
    lockProvider.acquire.yieldsAsync();
    testNoLock(done);
  },

  'test stop sync scheduler': function(done) {
    lockProvider.acquire.reset();
    lockProvider.acquire.yieldsAsync();
    var SyncScheduler = syncSchedulerModule(lockProvider, syncStorage, metricsClient).SyncScheduler;
    var scheduler = new SyncScheduler({}, {timeBetweenChecks: 50});
    sinon.spy(scheduler, 'start');
    scheduler.start();
    setTimeout(function(){
      scheduler.stop();
      setTimeout(function(){
        assert.equal(scheduler.start.callCount, 1);
        done();
      }, 20);
    }, 40);
  }
};