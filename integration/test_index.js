var sync = require('../lib');
var helper = require('./helper');
var assert = require('assert');
var util = require('util');
var async = require('async');

var mongoDBUrl = 'mongodb://127.0.0.1:27017/test_index';
var redisUrl = 'redis://127.0.0.1:6379';
var DATASETID = 'testSyncInitStop';

module.exports = {
  'test sync connect': {
    'beforeEach': function(done){
      helper.resetDb(mongoDBUrl, DATASETID, done);
    },
    'afterEach': function(done){
      sync.api.stopAll(done);
    },

    'should allow setting globalInterceptRequest before init': function(done) {
      sync.api.globalInterceptRequest(function() {
        throw new Error('globalInterceptRequest should never be called here');
      });
      return done();
    },

    'should allow setting interceptRequest before init': function(done) {
      sync.api.interceptRequest(function() {
        throw new Error('interceptRequest should never be called here');
      });
      return done();
    },

    'should allow setting globalHandleCollision before init': function(done) {
      sync.api.globalHandleCollision(function() {
        throw new Error('globalHandleCollision should never be called here');
      });
      return done();
    },

    'should allow setting globalListCollisions before init': function(done) {
      sync.api.globalListCollisions(function() {
        throw new Error('globalListCollisions should never be called here');
      });
      return done();
    },

    'should allow setting globalRemoveCollision before init': function(done) {
      sync.api.globalRemoveCollision(function() {
        throw new Error('globalRemoveCollision should never be called here');
      });
      return done();
    },

    'should allow setting handleCollision before init': function(done) {
      sync.api.handleCollision('testdatasetid', function() {
        throw new Error('handleCollision should never be called here');
      });
      return done();
    },

    'should allow setting listCollisions before init': function(done) {
      sync.api.listCollisions('testdatasetid', function() {
        throw new Error('listCollisions should never be called here');
      });
      return done();
    },

    'should allow setting removeCollision before init': function(done) {
      sync.api.removeCollision('testdatasetid', function() {
        throw new Error('removeCollision should never be called here');
      });
      return done();
    },

    'should allow setting globalHandleCreate before init': function(done) {
      sync.api.globalHandleCreate(function() {
        throw new Error('globalHandleCreate should never be called here');
      });
      return done();
    },

    'should allow setting globalHandleRead before init': function(done) {
      sync.api.globalHandleRead(function() {
        throw new Error('globalHandleRead should never be called here');
      });
      return done();
    },

    'should allow setting globalHandleUpdate before init': function(done) {
      sync.api.globalHandleUpdate(function() {
        throw new Error('globalHandleUpdate should never be called here');
      });
      return done();
    },

    'should allow setting globalHandleDelete before init': function(done) {
      sync.api.globalHandleDelete(function() {
        throw new Error('globalHandleDelete should never be called here');
      });
      return done();
    },

    'should allow setting globalHandleList before init': function(done) {
      sync.api.globalHandleList(function() {
        throw new Error('globalHandleList should never be called here');
      });
      return done();
    },

    'should allow setting handleCreate before init': function(done) {
      sync.api.handleCreate('testdatasetid', function() {
        throw new Error('handleCreate should never be called here');
      });
      return done();
    },

    'should allow setting handleRead before init': function(done) {
      sync.api.handleRead('testdatasetid', function() {
        throw new Error('handleRead should never be called here');
      });
      return done();
    },

    'should allow setting handleUpdate before init': function(done) {
      sync.api.handleUpdate('testdatasetid', function() {
        throw new Error('handleUpdate should never be called here');
      });
      return done();
    },

    'should allow setting handleDelete before init': function(done) {
      sync.api.handleDelete('testdatasetid', function() {
        throw new Error('handleDelete should never be called here');
      });
      return done();
    },

    'should allow setting handleList before init': function(done) {
      sync.api.handleList('testdatasetid', function() {
        throw new Error('handleList should never be called here');
      });
      return done();
    },

    'should allow setting setGlobalHashFn before init': function(done) {
      sync.api.setGlobalHashFn(function() {
        throw new Error('setGlobalHashFn should never be called here');
      });
      return done();
    },

    'should allow setting setRecordHashFn before init': function(done) {
      sync.api.setRecordHashFn('testdatasetid', function() {
        throw new Error('setRecordHashFn should never be called here');
      });
      return done();
    },
    
    'should connect ok': function(finish) {
      var readyEmitted = false;
      sync.api.getEventEmitter().on('sync:ready', function onSyncReady() {
        readyEmitted = true;
      });
      // assume redis & mongodb on localhost with default ports
      sync.api.connect(mongoDBUrl, {}, redisUrl, function(err, mongoDbClient, redisClient) {
        assert.ok(!err, util.inspect(err));
        assert.ok(readyEmitted, 'Expected sync:ready event to be emitted');
        var mClient = mongoDbClient;
        var rClient = redisClient;
        assert.ok(mongoDbClient);
        assert.ok(rClient);

        async.series([function testMongoDBConnection(cb) {
          var testValue = 'test value ' + Date.now();
          var col = mClient.collection('test_sync_connect');
          col.insertOne({value: testValue},function(err) {
            assert.equal(null, err);
            col.drop(function(err) {
              assert.equal(null, err);
              finish();
            });
          });
        }], function(err) {
          assert.ok(!err, util.inspect(err));
          return finish();
        });
      });
    }
  }
};