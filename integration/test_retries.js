var sync = require('../lib');
var assert = require('assert');
var util = require('util');
var async = require('async');
var helper = require('./helper');
var sinon = require('sinon');

var mongoDBUrl = 'mongodb://127.0.0.1:27017/test_sync_api';
var redisUrl = 'redis://127.0.0.1:6379';
var DATASETID = 'syncIntegrationTest';
var TESTCUID = 'syncIntegrationTestCuid';

var firstCall = true;
var testdata = {};

var testCreateHandler = function(dataset_id, data, meta_data, cb){
  console.log("test create handler called");
  testdata.first = data;
  return cb(null, {uid:"first", data: data});
}

var testUpdateHandler = function(dataset_id, uid, data, meta_data, cb) {
  if (firstCall) {
    console.log("test update handler called to return error");
    firstCall = false;
    return cb(new Error("injected error")); 
  } else {
    console.log("test update handler called to return data", data);
    testdata.first = data;
    return cb(null, {uid:"first", data: data});
  }
}

var testReadHandler = function(dataset_id, uid, meta_data, cb) {
  console.log("test read handler called to return data", testdata.first);
  return cb(null, testdata.first);
}

var collisionHandler = sinon.stub;
collisionHandler.yieldsAsync(null, {});

module.exports = {
  'test retry pending changes': {
    'before': function(done) {
      sync.api.setConfig({
        syncWorkerInterval: 100, 
        syncWorkerBackoff: {strategy: 'none'},
        pendingWorkerInterval: 100, 
        ackWorkerInterval: 100, 
        schedulerInterval: 100, 
        schedulerLockName: 'test:syncApi:lock', 
        useCache: true,
        cuidProducer: function(params) {
          return params.__fh.cuid + params.query_params.user;
        },
        pendingWorkerRetryLimit: 2,
        pendingWorkerRetryIntervalInSeconds: 1
      });

      sync.api.globalHandleCreate(testCreateHandler);
      sync.api.globalHandleUpdate(testUpdateHandler);
      sync.api.globalHandleRead(testReadHandler);
      sync.api.globalHandleCollision(collisionHandler);
      async.series([
        async.apply(sync.api.connect, mongoDBUrl, null, redisUrl),
        async.apply(sync.api.init, DATASETID, {syncFrequency: 1}),
        function resetdb(callback) {
          helper.resetDb(mongoDBUrl, DATASETID, function(err, db){
            if (err) {
              return callback(err);
            }
            mongodb = db;
            return callback();
          });
        },
        async.apply(sync.api.connect, mongoDBUrl, null, null)
      ], done);
    },
    'after': function(done) {
      sync.api.stopAll(done);
    },
    'invoke sync': function(done) {
      var params = {
        fn: 'sync',
        query_params: {user: '1'},
        meta_data: {token: 'testtoken'},
        __fh: {
          cuid: TESTCUID
        },
        pending: [{
          action: 'create',
          hash: 'a1',
          uid: 'first',
          post: {
            'a': '1',
            'user': '1'
          }
        }, {
          action: 'update',
          hash: 'a2',
          uid: 'first',
          pre: {
            'a': '1',
            'user': '1'
          },
          post: {
            'a': '2',
            'user': '1'
          }
        }, {
          action: 'update',
          hash: 'a3',
          uid: 'first',
          pre: {
            'a': '2',
            'user': '1'
          },
          post: {
            'a': '3',
            'user': '1'
          }
        }]
      };
      async.series([
        function invokeSync(callback) {
          sync.api.invoke(DATASETID, params, function(err, response){
            assert.ok(!err, util.inspect(err));
            assert.ok(response);
            callback();
          });
        },
        function waitForSyncLoopComplete(callback){
          setTimeout(callback, 4000);
        },
        function checkData(callback) {
          var data = testdata.first;
          //if the retry works, the data should be updated
          assert.equal(data.a, '3');
          //there should be no collision
          assert.ok(!collisionHandler.called);
          callback();
        }
      ], function(err){
        assert.ok(!err);
        done();
      });
    }
  }
}
