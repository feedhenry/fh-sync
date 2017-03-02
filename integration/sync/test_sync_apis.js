var sync = require('../../lib/sync');
var assert = require('assert');
var util = require('util');
var async = require('async');
var helper = require('./helper');
var syncUitl = require('../../lib/sync/util');
var storageModule = require('../../lib/sync/storage');
var _ = require('underscore');

var mongoDBUrl = 'mongodb://127.0.0.1:27017/test_sync_api';
var DATASETID = 'syncIntegrationTest';
var TESTCUID = 'syncIntegrationTestCuid';

var mongodb;

module.exports = {
  'test sync & syncRecords apis': {
    'before': function(done) {
      sync.api.init(DATASETID, {syncFrequency: 1}, function(){});
      sync.api.setLogLevel(DATASETID, {logLevel: 'debug'});
      sync.api.setLogLevel(syncUitl.SYNC_LOGGER, {logLevel: 'debug'});
      async.series([
        function resetdb(callback) {
          helper.resetDb(mongoDBUrl, DATASETID, function(err, db){
            if (err) {
              return callback(err);
            }
            mongodb = db;
            return callback();
          });
        },
        async.apply(helper.insertDocsToDb, mongoDBUrl, DATASETID, [{'b': '2', 'user': '1'}, {'c': '3', 'user': '1'}]),
        async.apply(sync.api.connect, mongoDBUrl, null, null)
      ], done);
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
        }]
      };
      var ack;
      async.series([
        function invokeSync(callback) {
          sync.api.invoke(DATASETID, params, function(err, response){
            assert.ok(!err);
            assert.ok(response);
            callback();
          });
        },
        function waitForSyncLoopComplete(callback){
          setTimeout(callback, 3000);
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
        function receiveAck(callback) {
          params.pending = [];
          sync.api.invoke(DATASETID, params, function(err, response){
            assert.ok(!err);
            assert.ok(response.hash);
            assert.ok(response.updates.hashes);
            assert.ok(response.updates.applied['a1']);
            ack = response.updates.applied['a1'];
            callback();
          });
        },
        function sendAck(callback) {
          params.acknowledgements = [ack];
          sync.api.invoke(DATASETID, params, function(err, response){
            assert.ok(!err);
            callback();
          });
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
          syncRecordsParams.clientRecs[ack.uid] = "wronghash";
          sync.api.invoke(DATASETID, syncRecordsParams, function(err, response){
            assert.ok(!err);
            assert.ok(response.hash);
            assert.ok(response.create);
            assert.ok(response.update);
            assert.equal(_.size(response.create), 2);
            assert.equal(_.size(response.update), 1);
            callback();
          });
        },
        function waitForAckToBeProcessed(callback) {
          setTimeout(callback, 1000);
        },
        function makeSureAckProcessed(callback) {
          var col = mongodb.collection(storageModule.getDatasetUpdatesCollectionName(DATASETID));
          col.findOne({cuid: ack.cuid, hash: ack.hash}, function(err, found){
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