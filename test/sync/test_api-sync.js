var assert = require('assert');
var sinon = require('sinon');
var apiSyncModule = require('../../lib/sync/api-sync');

var interceptors = {
  requestInterceptor: sinon.stub(),
  responseInterceptor: sinon.stub()
};

var syncStorage = {
  upsertDatasetClient: sinon.stub(),
  listUpdates: sinon.stub(),
  readDatasetClient: sinon.stub()
};

var ackQueue = {
  addMany: sinon.stub(),
  getName: function() {
    return 'ackQueue';
  }
};

var pendingQueue = {
  addMany: sinon.stub(),
  getName: function() {
    return 'pendingQueue';
  }
};

var DATASETID = "testsyncapi";

var resetStubs = function(){
  interceptors.requestInterceptor.reset();
  interceptors.responseInterceptor.reset();
  syncStorage.upsertDatasetClient.reset();
  syncStorage.listUpdates.reset();
  syncStorage.readDatasetClient.reset();
  ackQueue.addMany.reset();
  ackQueue.addMany.reset();
};

module.exports = {
  'beforeEach': function(){
    resetStubs();
  },

  'test api sync success': function(done) {
    var apiSync = apiSyncModule(interceptors, ackQueue, pendingQueue, syncStorage);
    var acknowledgements = [{
      type: 'action',
      hash: 'ackhash',
      uid: 'ackuid'
    }];
    var pending = [{
      action: 'create',
      uid: 'pendingcreateuid',
      hash: 'pendingcreatehash',
      post: {'a': '1'}
    }];
    var params = {
      query_params: {},
      meta_data: {},
      acknowledgements: acknowledgements,
      pending: pending,
      __fh: {
        cuid: 'testcuid'
      }
    };

    var updates = [{
      'type': 'applied',
      'hash': 'updatehash',
      'action': 'update',
      'uid': 'updateuid'
    }];

    var globalHash = "globalHash";

    interceptors.requestInterceptor.yieldsAsync();
    interceptors.responseInterceptor.yieldsAsync();
    syncStorage.readDatasetClient.yieldsAsync();
    syncStorage.upsertDatasetClient.yieldsAsync(null, {globalHash: globalHash});
    syncStorage.listUpdates.yieldsAsync(null, updates);
    ackQueue.addMany.yieldsAsync();
    pendingQueue.addMany.yieldsAsync();
    apiSync(DATASETID, params, function(err, res){
      assert.ok(!err);
      assert.ok(interceptors.requestInterceptor.calledOnce);
      assert.ok(interceptors.requestInterceptor.calledWith(DATASETID, params));
      assert.ok(syncStorage.upsertDatasetClient.calledOnce);

      assert.ok(ackQueue.addMany.calledOnce);
      var ackItems = ackQueue.addMany.args[0][0];
      assert.equal(ackItems.length, 1);
      assert.equal(ackItems[0].datasetId, DATASETID);
      assert.equal(ackItems[0].cuid, params.__fh.cuid);

      assert.ok(pendingQueue.addMany.calledOnce);
      var pendingItems = pendingQueue.addMany.args[0][0];
      assert.equal(pendingItems.length, 1);
      assert.equal(pendingItems[0].datasetId, DATASETID);
      assert.equal(pendingItems[0].cuid, params.__fh.cuid);
      assert.ok(pendingItems[0].meta_data);

      assert.ok(syncStorage.listUpdates.calledOnce);
      assert.ok(syncStorage.listUpdates.calledWith(DATASETID, {cuid: params.__fh.cuid}));

      assert.ok(interceptors.responseInterceptor.calledOnce);

      assert.equal(res.hash, globalHash);
      assert.ok(res.updates.hashes);
      assert.ok(res.updates.applied);
      assert.ok(res.updates.applied.updatehash);
      done();
    });
  }
}