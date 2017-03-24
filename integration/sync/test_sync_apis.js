var sync = require('../../lib/sync');
var assert = require('assert');
var util = require('util');
var async = require('async');
var helper = require('./helper');
var syncUtil = require('../../lib/sync/util');
var storageModule = require('../../lib/sync/storage');
var _ = require('underscore');

var mongoDBUrl = 'mongodb://127.0.0.1:27017/test_sync_api';
var redisUrl = 'redis://127.0.0.1:6379';
var DATASETID = 'syncIntegrationTest';
var TESTCUID = 'syncIntegrationTestCuid';

var mongodb;
var recordBUid;
var recordCUid;

module.exports = {
  'test sync & syncRecords apis': {
    'before': function(done) {
      sync.api.setConfig({syncWorkerInterval: 100, pendingWorkerInterval: 100, ackWorkerInterval: 100, schedulerInterval: 100, schedulerLockName: 'test:syncApi:lock', useCache: true});
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
        function createRecords(callback) {
          helper.insertDocsToDb(mongoDBUrl, DATASETID, [{'b': '2', 'user': '1'}, {'c': '3', 'user': '1'}], function(err, result){
            if (err) {
              return callback(err);
            }
            if (result.insertedIds) {
              recordBUid = result.insertedIds[0].toString();
              recordCUid = result.insertedIds[1].toString();
              return callback();
            } else {
              return callback(new Error('no insertedIds found'));
            }
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
          uid: 'client-a1',
          post: {
            'a': '1',
            'user': '1'
          }
        }, {
          action: 'update',
          hash: 'b1',
          uid: recordBUid,
          pre: {
            'b': '2',
            'user': '1'
          },
          post: {
            'b': '2b',
            'user': '1'
          }
        }, {
          action: 'delete',
          hash: 'c1',
          uid: recordCUid,
          pre: {
            'c': '3',
            'user': '1'
          }
        }]
      };
      var ackA, ackB, ackC;
      async.series([
        function invokeSync(callback) {
          sync.api.invoke(DATASETID, params, function(err, response){
            assert.ok(!err);
            assert.ok(response);
            callback();
          });
        },
        function waitForSyncLoopComplete(callback){
          setTimeout(callback, 500);
        },
        function checkDataCreated(callback) {
          //at this point, data should be created in db
          var collection = mongodb.collection(DATASETID);
          collection.findOne({'a':'1'}, function(err, found){
            assert.ok(!err);
            assert.ok(found);
            callback();
          });
        },
        function checkDataUpdated(callback) {
          //at this point, data should be created in db
          var collection = mongodb.collection(DATASETID);
          collection.findOne({'b':'2b'}, function(err, found){
            assert.ok(!err);
            assert.ok(found);
            callback();
          });
        },
        function checkDataDeleted(callback) {
          //at this point, data should be created in db
          var collection = mongodb.collection(DATASETID);
          collection.findOne({'c':'3'}, function(err, found){
            assert.ok(!err);
            assert.ok(!found);
            callback();
          });
        },
        function receiveAck(callback) {
          params.pending = [];
          sync.api.invoke(DATASETID, params, function(err, response){
            assert.ok(!err);
            assert.ok(response.hash);
            assert.ok(response.updates.hashes);
            assert.ok(response.updates.applied['a1']);
            assert.ok(response.updates.applied['b1']);
            assert.ok(response.updates.applied['c1']);
            ackA = response.updates.applied['a1'];
            ackB = response.updates.applied['b1'];
            ackC = response.updates.applied['c1'];
            callback();
          });
        },
        function sendAck(callback) {
          params.acknowledgements = [ackA, ackB, ackC];
          sync.api.invoke(DATASETID, params, function(err, response){
            assert.ok(!err);
            callback();
          });
        },
        function waitForAckToBeProcessed(callback) {
          setTimeout(callback, 1100);
        },
        function syncRecords(callback) {
          var syncRecordsParams = {
            fn: 'syncRecords',
            query_params: {user: '1'},
            meta_data: {token: 'testtoken'},
            __fh: {
              cuid: TESTCUID
            },
            clientRecs: {}
          };
          //the hash value is wrong, so there should be an update
          syncRecordsParams.clientRecs[ackA.uid] = "wronghash";
          sync.api.invoke(DATASETID, syncRecordsParams, function(err, response){
            assert.ok(!err);
            assert.ok(response.hash);
            assert.ok(response.create);
            assert.ok(response.update);
            assert.equal(_.size(response.create), 1);
            assert.equal(_.size(response.update), 1);
            callback();
          });
        },
        function makeSureAckAProcessed(callback) {
          var col = mongodb.collection(storageModule.getDatasetUpdatesCollectionName(DATASETID));
          col.findOne({cuid: ackA.cuid, hash: ackA.hash}, function(err, found){
            assert.ok(!err);
            assert.ok(!found);
            callback();
          });
        },
        function makeSureAckBProcessed(callback) {
          var col = mongodb.collection(storageModule.getDatasetUpdatesCollectionName(DATASETID));
          col.findOne({cuid: ackB.cuid, hash: ackB.hash}, function(err, found){
            assert.ok(!err);
            assert.ok(!found);
            callback();
          });
        },
        function makeSureAckCProcessed(callback) {
          var col = mongodb.collection(storageModule.getDatasetUpdatesCollectionName(DATASETID));
          col.findOne({cuid: ackC.cuid, hash: ackC.hash}, function(err, found){
            assert.ok(!err);
            assert.ok(!found);
            callback();
          });
        }
      ], function(err){
        assert.ok(!err);
        done();
      });
    }
  }
}
