var assert = require('assert');
var async = require('async');
var helper = require('./helper');
var sinon = require('sinon');
var sync = require('../../lib/sync');
var syncUitl = require('../../lib/sync/util');

var MONGODB_URL = "mongodb://127.0.0.1:27017/test_dataHandler_overrides";
var DATASETID = 'syncDataHandlerOverridesTest';
var TESTCUID = 'syncDataHandlerOverridesTestCuid';

module.exports = {
  'test dataHandler overrides': {
    'beforeEach': function(done) {
      sync.api.setConfig({pendingWorkerInterval: 100, ackWorkerInterval: 100, syncWorkerInterval: 100, schedulerInterval: 100, schedulerLockName: 'test:datahandler:lock'});
      async.series([
        async.apply(helper.resetDb, MONGODB_URL, DATASETID),
        async.apply(sync.api.connect, MONGODB_URL, null, null)
      ], done);
    },
    'afterEach': function(done) {
      sync.api.stopAll(done);
    },
    'test global overrides': function(done) {
      var globalCreate = sinon.stub();
      var globalRead = sinon.stub();
      var globalUpdate = sinon.stub();
      var globalList = sinon.stub();
      var globalDelete = sinon.stub();
      globalCreate.yieldsAsync(null, {uid: '1', data: {'value':'a'}});
      globalRead.yieldsAsync(null, {'value': 'a'});
      globalUpdate.yieldsAsync(null, {'value': 'a'});
      globalList.yieldsAsync(null, {'1': {'value': 'a'}});
      globalDelete.yieldsAsync(null, {'value': 'a'});

      sync.api.globalHandleList(globalList);
      sync.api.globalHandleCreate(globalCreate);
      sync.api.globalHandleRead(globalRead);
      sync.api.globalHandleUpdate(globalUpdate);
      sync.api.globalHandleDelete(globalDelete);

      var params = {
        fn: 'sync',
        query_params: {},
        meta_data: {},
        __fh: {
          cuid: TESTCUID
        },
        pending: [{
          action: 'create',
          hash: 'a1',
          uid: 'client-a1',
          post: {'value': 'a'}
        }, {
          action: 'update',
          hash: 'a2',
          uid: '1',
          pre: {'value': 'a'},
          post: {'value': 'b'}
        }, {
          action: 'delete',
          hash: 'a3',
          uid: '1',
          pre: {'value': 'a'}
        }]
      };

      async.series([
        async.apply(sync.api.invoke, DATASETID, params),
        function waitForPendingProcessed(callback) {
          setTimeout(callback, 400);
        },
        function checkOverridesCalled(callback) {
          assert.ok(globalCreate.called);
          assert.ok(globalRead.called);
          assert.ok(globalUpdate.called);
          assert.ok(globalList.called);
          assert.ok(globalDelete.called);
          callback();
        }
      ], done);
    },
    'test overrides for dataset': function(done) {
      var datasetCreate = sinon.stub();
      var datasetRead = sinon.stub();
      var datasetUpdate = sinon.stub();
      var datasetList = sinon.stub();
      var datasetDelete = sinon.stub();
      datasetCreate.yieldsAsync(null, {uid: '1', data: {'value':'a'}});
      datasetRead.yieldsAsync(null, {'value': 'a'});
      datasetUpdate.yieldsAsync(null, {'value': 'a'});
      datasetList.yieldsAsync(null, {'1': {'value': 'a'}});
      datasetDelete.yieldsAsync(null, {'value': 'a'});

      sync.api.handleList(DATASETID, datasetList);
      sync.api.handleCreate(DATASETID, datasetCreate);
      sync.api.handleRead(DATASETID, datasetRead);
      sync.api.handleUpdate(DATASETID, datasetUpdate);
      sync.api.handleDelete(DATASETID, datasetDelete);

      var params = {
        fn: 'sync',
        query_params: {},
        meta_data: {},
        __fh: {
          cuid: TESTCUID
        },
        pending: [{
          action: 'create',
          hash: 'a1',
          uid: 'client-a1',
          post: {'value': 'a'}
        }, {
          action: 'update',
          hash: 'a2',
          uid: '1',
          pre: {'value': 'a'},
          post: {'value': 'b'}
        }, {
          action: 'delete',
          hash: 'a3',
          uid: '1',
          pre: {'value': 'a'}
        }]
      };

      async.series([
        async.apply(sync.api.invoke, DATASETID, params),
        function waitForPendingProcessed(callback) {
          setTimeout(callback, 400);
        },
        function checkOverridesCalled(callback) {
          assert.ok(datasetCreate.called);
          assert.ok(datasetRead.called);
          assert.ok(datasetUpdate.called);
          assert.ok(datasetList.called);
          assert.ok(datasetDelete.called);
          callback();
        }
      ], done);
    }
  }
}