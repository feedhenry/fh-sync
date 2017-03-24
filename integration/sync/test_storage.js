var storageModule = require('../../lib/sync/storage');
var cacheClientModule = require('../../lib/sync/sync-cache');
var MongoClient = require('mongodb').MongoClient;
var async = require('async');
var assert = require('assert');
var _ = require('underscore');
var helper = require('./helper');

var DATASETID = "storageIntegrationTest";

var DATASETCLIENTS_COLLECTION = storageModule.DATASETCLIENTS_COLLECTION;
var RECORDS_COLLECTION = storageModule.getDatasetRecordsCollectionName(DATASETID);

var MONGODB_URL = "mongodb://127.0.0.1:27017/test_storage";

var datasetClient1 = {
  id: 'storageIntegrationTestId1',
  datasetId: DATASETID,
  queryParams: {userId: 'user1'},
  metaData: {},
  config: {},
  props: {},
  globalHash: 'storageIntegrationTestHash1'
};
var datasetClient2 = {
  id: 'storageIntegrationTestId2',
  datasetId: DATASETID,
  queryParams: {userId: 'user2'},
  metaData: {},
  config: {},
  props: {},
  globalHash: 'storageIntegrationTestHash2'
};

var TESTCUID = 'testcuid1';
var ack1 = {
  type: 'applied',
  cuid: TESTCUID,
  action: 'create',
  hash: 'a',
  uid: '1',
  msg: '',
  timestamp: Date.now()
};

var ack2 = {
  type: 'failed',
  cuid: TESTCUID,
  action: 'update',
  hash: 'b',
  uid: '1',
  msg: '',
  timestamp: Date.now()
};

var mongodb;
var storage;

function recordMatch(expect, actual) {
  assert.equal(expect.uid, actual.uid);
  assert.equal(expect.hash, actual.hash);
  assert.deepEqual(expect.data, actual.data);
}

module.exports = {
  'test storage functions': {
    'before': function(done) {
      var cacheClient = cacheClientModule();
      helper.resetDb(MONGODB_URL, DATASETID, function(err, db){
        if (err) {
          return done(err);
        }
        mongodb = db;
        storage = storageModule(mongodb, cacheClient);
        done();
      });
    },
    'test dataset client create and list': function(done){
      async.series([
        async.apply(storage.upsertDatasetClient, datasetClient1.id, datasetClient1),
        async.apply(storage.upsertDatasetClient, datasetClient2.id, datasetClient2)
      ], function(err){
        assert.ok(!err);
        
        storage.listDatasetClients(function(err, savedDatasetClients){
          assert.ok(!err);
          assert.equal(savedDatasetClients.length, 2);
          done();
        })
      });
    },
    'test dataset client update': function(done) {
      var datasetClientUpdateFields = {
        props: {syncRunning: true},
        metaData: {token: 'testToken'}
      };
      async.series([
        async.apply(storage.upsertDatasetClient, datasetClient1.id, datasetClient1),
        async.apply(storage.updateDatasetClient, datasetClient1.id, datasetClientUpdateFields)
      ], function(err){
        assert.ok(!err);
        var col = mongodb.collection(DATASETCLIENTS_COLLECTION);
        col.findOne({id: datasetClient1.id}, function(err, updated){
          assert.ok(!err);
          assert.equal(updated.id, datasetClient1.id);
          assert.equal(updated.props.syncRunning, datasetClientUpdateFields.props.syncRunning);
          assert.equal(updated.metaData.token, datasetClientUpdateFields.metaData.token);
          assert.deepEqual(updated.queryParams, datasetClient1.queryParams);
          assert.deepEqual(updated.config, datasetClient1.config);
          done();
        });
      });
    },
    'test dataset client update when null': function(done) {
      var datasetClientUpdateFields = {
        props: {syncRunning: true},
        metaData: {token: 'testToken'}
      };
      async.series([
        async.apply(storage.updateDatasetClient, 'invalid_id', datasetClientUpdateFields),
      ], function(err){
        assert.ok(err);
        assert.equal(err.message, 'DatasetClient not found for id invalid_id');
        done();
      });
    },
    'test dataset client remove': function(done) {
      async.series([
        async.apply(storage.upsertDatasetClient, datasetClient1.id, datasetClient1),
        async.apply(storage.upsertDatasetClient, datasetClient2.id, datasetClient2),
        async.apply(storage.removeDatasetClients, [datasetClient1])
      ], function(err){
        assert.ok(!err);
        storage.listDatasetClients(function(err, savedDatasetClients){
          assert.ok(!err);
          assert.equal(savedDatasetClients.length, 1);
          done();
        });
      });
    },
    'test operations on dataset client with records': function(done) {
      var records = [{
        uid: '1',
        hash: 'a',
        data: {
          '1': 'a'
        }
      }, {
        uid: '2',
        hash: 'b',
        data: {
          '2': 'b'
        }
      }];
      var updateRecords = [{
        uid: '1',
        hash: 'c',
        data: {
          '1': 'c'
        }
      }];
      async.series([
        function createDatasetClient(callback){
          storage.upsertDatasetClient(datasetClient1.id, datasetClient1, function(err, created){
            assert.ok(!err);
            assert.ok(created);
            callback();
          });
        },
        async.apply(storage.updateDatasetClientWithRecords, datasetClient1.id, {props: {syncCompleted: true}}, records),
        function checkRecordsAreCreatedForDatasetClient(callback){
          storage.readDatasetClientWithRecords(datasetClient1.id, function(err, datasetClient){
            assert.ok(!err);
            assert.equal(datasetClient.props.syncCompleted, true);
            assert.equal(datasetClient.records.length, 2);
            assert.equal(datasetClient.recordUids.length, 2);
            var record1 = _.findWhere(datasetClient.records, {uid: '1'});
            var record2 = _.findWhere(datasetClient.records, {uid: '2'});
            recordMatch(record1, records[0]);
            recordMatch(record2, records[1]);
            callback();
          });
        },
        //run it again, there should be no change to the data
        async.apply(storage.updateDatasetClientWithRecords, datasetClient1.id, {props: {syncCompleted: true}}, records),
        function checkRecordsAreCreatedForDatasetClient(callback){
          storage.readDatasetClientWithRecords(datasetClient1.id, function(err, datasetClient){
            assert.ok(!err);
            assert.equal(datasetClient.props.syncCompleted, true);
            assert.equal(datasetClient.records.length, 2);
            assert.equal(datasetClient.recordUids.length, 2);
            var record1 = _.findWhere(datasetClient.records, {uid: '1'});
            var record2 = _.findWhere(datasetClient.records, {uid: '2'});
            recordMatch(record1, records[0]);
            recordMatch(record2, records[1]);
            callback();
          });
        },
        async.apply(storage.updateDatasetClientWithRecords, datasetClient1.id, {}, updateRecords),
        function checkRecordIsRemovedFromTheDatasetClient(callback) {
          storage.readDatasetClientWithRecords(datasetClient1.id, function(err, datasetClient){
            assert.ok(!err);
            assert.equal(datasetClient.records.length, 1);
            assert.equal(datasetClient.recordUids.length, 1);
            var updateRecord = _.findWhere(datasetClient.records, {uid: '1'});
            recordMatch(updateRecord, updateRecords[0]);
            callback();
          });
        },
        async.apply(storage.removeDatasetClients, [datasetClient1]),
        function checkDatasetClientIsDeleted(callback) {
          storage.readDatasetClientWithRecords(datasetClient1.id, function(err, datasetClient){
            assert.ok(!err);
            assert.ok(!datasetClient);
            callback();
          });
        },
        function checkRecordIsDeleted(callback) {
          var recordCollection = mongodb.collection(RECORDS_COLLECTION);
          recordCollection.findOne({uid: records[0].uid}, function(err, found){
            assert.ok(!err);
            assert.ok(!found);
            callback();
          });
        }
      ], function(err){
        assert.ok(!err);
        done();
      });
    },
    'test update many dataset clients': function(done) {
      async.series([
        async.apply(storage.upsertDatasetClient, datasetClient1.id, datasetClient1),
        async.apply(storage.upsertDatasetClient, datasetClient2.id, datasetClient2),
        async.apply(storage.updateManyDatasetClients, {}, {stopped: true}),
      ], function(err){
        assert.ok(!err);
        storage.listDatasetClients(function(err, savedDatasetClients){
          assert.ok(!err);
          assert.equal(savedDatasetClients[0].stopped, true);
          assert.equal(savedDatasetClients[1].stopped, true);
          done();
        });
      });
    },
    'test operations on the sync updates': function(done) {
      async.series([
        async.apply(storage.saveUpdate, DATASETID, ack1),
        async.apply(storage.saveUpdate, DATASETID, ack2),
        function checkSyncUpdatesCreated(callback) {
          storage.listUpdates(DATASETID, {cuid: TESTCUID}, function(err, updates){
            assert.ok(!err);
            assert.equal(updates.length, 2);
            callback();
          });
        },
        async.apply(storage.findAndDeleteUpdate, DATASETID, ack1),
        function checkSyncUpdatesRemoved(callback) {
          storage.listUpdates(DATASETID, {cuid: TESTCUID}, function(err, updates){
            assert.ok(!err);
            assert.equal(updates.length, 1);
            delete updates[0]._id;
            assert.deepEqual(updates[0], ack2);
            callback();
          });
        }
      ], function(err){
        assert.ok(!err);
        done();
      });
    }
  }
};