var assert = require('assert');
var sinon = require('sinon');
var syncProcessor = require('../../lib/sync/sync-processor');

var syncStorage = {
  saveLastSyncDataset: sinon.stub()
};

var dataHandler = {
  doList: sinon.stub()
};

var metricsClient = {};
var hashProvider = {
  recordHash: function(datasetId, data){
    return data;
  },
  globalHash: function(datasetId, hashes){
    return hashes.join('');
  }
};

module.exports = {
  'test sync request processor': function(done) {
    var processor = syncProcessor(syncStorage, dataHandler, metricsClient, hashProvider);
    var job = {
      payload: {
        dataset_id: 'testDataset'
      }
    };

    var records = {
      "1": "a",
      "2": "b",
      "3": "c"
    };

    dataHandler.doList.yieldsAsync(null, records);
    syncStorage.saveLastSyncDataset.yieldsAsync();

    processor(job, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doList.calledOnce);
      assert.ok(dataHandler.doList.calledWith(job.payload.dataset_id, {}, {}));
      assert.ok(syncStorage.saveLastSyncDataset.calledOnce);
      assert.ok(syncStorage.saveLastSyncDataset.calledWith(job.payload.dataset_id, "abc"));
      done();
    });
  }
};