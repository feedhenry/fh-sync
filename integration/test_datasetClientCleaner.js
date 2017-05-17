var storageModule = require('../lib/storage');
var lockModule = require('../lib/lock');
var async = require('async');
var assert = require('assert');
var _ = require('underscore');
var helper = require('./helper');
var datasetClientCleanerModule = require('../lib/datasetClientsCleaner');
var DatasetClient = require('../lib/DatasetClient')

var DATASETID = "datasetClientCleanerTest";
var DATASETCLIENTS_COLLECTION = storageModule.DATASETCLIENTS_COLLECTION;

var MONGODB_URL = "mongodb://127.0.0.1:27017/test_datasetClientsCleaner";

var inactiveDatasetClient = new DatasetClient(DATASETID, {
  datasetId: DATASETID,
  queryParams: {'user': '1'},
  metaData: {},
  config: {clientSyncTimeout: 1},
  lastAccessed: Date.now() - 5*1000
});
var inactiveDCJson = inactiveDatasetClient.toJSON();
inactiveDCJson.active = false;

var activeDatasetClient = new DatasetClient(DATASETID, {
  datasetId: DATASETID,
  queryParams: {'user': '2'},
  metaData: {},
  config: {clientSyncTimeout: 1}
});
var activeDCJson = activeDatasetClient.toJSON();
activeDCJson.active = true;

var mongodb;
var storage;
var lock;

var cleaner;

module.exports = {
  'test datasetClients cleaner': {
    'beforeEach': function(done) {
      helper.resetDb(MONGODB_URL, DATASETID, function(err, db){
        if (err) {
          return done(err);
        }
        mongodb = db;
        storage = storageModule(mongodb, null);
        lock = lockModule(mongodb);
        cleaner = datasetClientCleanerModule(storage, lock)({retentionPeriod: '50ms', cleanerLockName: 'test_datasetCleaner_lock'});
        done();
      });
    },
    'afterEach': function(done){
      cleaner? cleaner.stop(done): done();
    },
    'test remove inactive dataset clients': function(done) {
      async.series([
        async.apply(storage.upsertDatasetClient, inactiveDCJson.id, inactiveDCJson),
        async.apply(storage.upsertDatasetClient, activeDCJson.id, activeDCJson),
        function startCleaner(callback) {
          cleaner.start(true, callback);
        },
        function wait(callback) {
          setTimeout(callback, 500);
        },
        function checkDatasetClient(callback) {
          var collection = mongodb.collection(DATASETCLIENTS_COLLECTION);
          collection.findOne({id: inactiveDCJson.id}, function(err, found){
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
    'test with no dataset clients': function(done) {
      async.series([
        function startCleaner(callback) {
          cleaner.start(true, callback);
        },
        function wait(callback) {
          setTimeout(callback, 500)
        }
      ], function(err){
        assert.ok(!err);
        done();
      });
    }
  }
};