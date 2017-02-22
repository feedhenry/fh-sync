var assert = require('assert');
var sinon = require('sinon');
var pendingProcessor = require('../../lib/sync/pending-processor');

var syncStorage = {
  saveUpdate: sinon.stub()
};

var dataHandler = {
  handleCollision: sinon.stub(),
  doCreate: sinon.stub(),
  doRead: sinon.stub(),
  doUpdate: sinon.stub(),
  doDelete: sinon.stub()
};

var hashProvider = {
  recordHash: function(datasetId, obj) {
    if (obj) {
      return obj.a;
    }
    return null;
  }
};

var metricsClient = {
  gauge: sinon.stub()
};

function resetStubs() {
  syncStorage.saveUpdate.reset();
  dataHandler.handleCollision.reset();
  dataHandler.doCreate.reset();
  dataHandler.doRead.reset();
  dataHandler.doUpdate.reset();
  dataHandler.doDelete.reset();
  metricsClient.gauge.reset();
}

var DATASETID = "testPendingChangeDataset";
var pendingProcessorImpl = pendingProcessor(syncStorage, dataHandler, hashProvider, metricsClient);

module.exports = {
  'beforeEach': function(){
    resetStubs();
  },

  'test creation success': function(done){
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "CREATE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testCreationSuccess',
        uid: 'clientuid',
        post: {'a': '1'}
      }
    };
    dataHandler.doCreate.yieldsAsync(null, {uid: 'serveruid'});
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doCreate.calledOnce);
      assert.ok(dataHandler.doCreate.calledWith(DATASETID, pending.payload.post, pending.payload.meta_data));
      assert.ok(syncStorage.saveUpdate.calledOnce);
      var expectedFields = {type: pendingProcessor.SYNC_UPDATE_TYPES.APPLIED, uid: 'serveruid', hash: pending.payload.hash};
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match(expectedFields)));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test creation failure': function(done) {
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "CREATE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testCreationSuccess',
        uid: 'clientuid',
        post: {'a': '1'}
      }
    };
    dataHandler.doCreate.yieldsAsync(new Error('creation failed'));
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doCreate.calledOnce);
      assert.ok(syncStorage.saveUpdate.calledOnce);
      var expectedFields = {type: pendingProcessor.SYNC_UPDATE_TYPES.FAILED, uid: 'clientuid', hash: pending.payload.hash};
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match(expectedFields)));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test update success': function(done) {
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "UPDATE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testUpdateSuccess',
        uid: 'updateuid',
        pre: {'a': '0'},
        post: {'a': '1'}
      }
    };
    dataHandler.doRead.yieldsAsync(null, {'a': '0'});
    dataHandler.doUpdate.yieldsAsync();
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doRead.calledOnce);
      assert.ok(dataHandler.doRead.calledWith(DATASETID, pending.payload.uid));
      assert.ok(dataHandler.doUpdate.calledOnce);
      assert.ok(dataHandler.doUpdate.calledWith(DATASETID, pending.payload.uid, pending.payload.post));
      assert.ok(dataHandler.handleCollision.notCalled);
      assert.ok(syncStorage.saveUpdate.calledOnce);
      var expectedFields = {type: pendingProcessor.SYNC_UPDATE_TYPES.APPLIED, uid: pending.payload.uid, hash: pending.payload.hash};
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match(expectedFields)));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test update ignored': function(done) {
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "UPDATE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testUpdateIgnored',
        uid: 'updateuid',
        pre: {'a': '0'},
        post: {'a': '1'}
      }
    };
    dataHandler.doRead.yieldsAsync(null, {'a': '1'});
    dataHandler.doUpdate.yieldsAsync();
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doRead.calledOnce);
      assert.ok(dataHandler.doUpdate.notCalled);
      assert.ok(dataHandler.handleCollision.notCalled);
      assert.ok(syncStorage.saveUpdate.calledOnce);
      var expectedFields = {type: pendingProcessor.SYNC_UPDATE_TYPES.APPLIED, uid: pending.payload.uid, hash: pending.payload.hash};
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match(expectedFields)));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test update collision': function(done) {
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "UPDATE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testUpdateCollision',
        uid: 'updateuid',
        pre: {'a': '0'},
        post: {'a': '1'},
        timestamp: Date.now()
      }
    };
    dataHandler.doRead.yieldsAsync(null, {'a': '2'});
    dataHandler.doUpdate.yieldsAsync();
    syncStorage.saveUpdate.yieldsAsync();
    dataHandler.handleCollision.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doRead.calledOnce);
      assert.ok(dataHandler.doUpdate.notCalled);
      assert.ok(dataHandler.handleCollision.calledOnce);
      var expectedCollision = {uid: pending.payload.uid, hash: '2', pre: pending.payload.pre, post: pending.payload.post, timestamp: pending.payload.timestamp};
      assert.ok(dataHandler.handleCollision.calledWith(DATASETID, pending.payload.meta_data, sinon.match(expectedCollision)));
      assert.ok(syncStorage.saveUpdate.calledOnce);
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match({type: pendingProcessor.SYNC_UPDATE_TYPES.COLLISION})));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test delete success': function(done) {
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "DELETE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testDeleteSuccess',
        uid: 'deleteuid',
        pre: {'a': '0'}
      }
    };
    dataHandler.doRead.yieldsAsync(null, {'a': '0'});
    dataHandler.doDelete.yieldsAsync();
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doRead.calledOnce);
      assert.ok(dataHandler.doDelete.calledOnce);
      assert.ok(dataHandler.handleCollision.notCalled);
      assert.ok(dataHandler.doDelete.calledWith(DATASETID, pending.payload.uid, pending.payload.meta_data));
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match({type: pendingProcessor.SYNC_UPDATE_TYPES.APPLIED})));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test delete ignored': function(done) {
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "DELETE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testDeleteSuccess',
        uid: 'deleteuid',
        pre: {'a': '0'}
      }
    };
    dataHandler.doRead.yieldsAsync();
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err) {
      assert.ok(!err);
      assert.ok(dataHandler.doRead.calledOnce);
      assert.ok(dataHandler.doDelete.notCalled);
      assert.ok(dataHandler.handleCollision.notCalled);
      assert.ok(syncStorage.saveUpdate.called);
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match({type: pendingProcessor.SYNC_UPDATE_TYPES.APPLIED})));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test delete collision': function(done) {
    var pending = {
      tries: 1,
      payload: {
        datasetId: DATASETID,
        action: "DELETE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testDeleteSuccess',
        uid: 'deleteuid',
        pre: {'a': '0'}
      }
    };
    dataHandler.doRead.yieldsAsync(null, {'a': '2'});
    dataHandler.doDelete.yieldsAsync();
    dataHandler.handleCollision.yieldsAsync();
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doRead.calledOnce);
      assert.ok(dataHandler.doDelete.notCalled);
      assert.ok(dataHandler.handleCollision.calledOnce);
      var expectedCollision = {uid: pending.payload.uid, hash: '2', pre: pending.payload.pre};
      assert.ok(dataHandler.handleCollision.calledWith(DATASETID, pending.payload.meta_data, sinon.match(expectedCollision)));
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match({type: pendingProcessor.SYNC_UPDATE_TYPES.COLLISION})));
      assert.ok(metricsClient.gauge.calledOnce);
      done();
    });
  },

  'test retry': function(done) {
    var pending = {
      tries: 2,
      payload: {
        datasetId: DATASETID,
        action: "DELETE",
        meta_data: {},
        cuid: 'testCuid',
        hash: 'testRetry',
        uid: 'deleteuid',
      }
    };
    syncStorage.saveUpdate.yieldsAsync();
    pendingProcessorImpl(pending, function(err){
      assert.ok(!err);
      assert.ok(dataHandler.doRead.notCalled);
      assert.ok(syncStorage.saveUpdate.calledOnce);
      assert.ok(syncStorage.saveUpdate.calledWith(DATASETID, sinon.match({msg: 'crashed'})));
      assert.ok(metricsClient.gauge.notCalled);
      done();
    });
  }
}