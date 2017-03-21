var sync = require('../../lib/sync');
var helper = require('./helper');
var assert = require('assert');
var util = require('util');
var async = require('async');

var mongoDBUrl = 'mongodb://127.0.0.1:27017/test_index';
var DATASETID = 'testSyncInitStop';

module.exports = {
  'test sync connect': {
    'before': function(done){
      helper.resetDb(mongoDBUrl, DATASETID, done);
    },
    'after': function(done){
      sync.api.stopAll(done);
    },
    'should connect ok': function(finish) {
      var readyEmitted = false;
      sync.api.getEventEmitter().on('sync:ready', function onSyncReady() {
        readyEmitted = true;
      });
      // assume redis & mongodb on localhost with default ports
      sync.api.connect(mongoDBUrl, {}, null, function(err, mongoDbClient, redisClient) {
        assert.ok(!err, util.inspect(err));
        assert.ok(readyEmitted, 'Expected sync:ready event to be emitted');
        var mClient = mongoDbClient;
        var rClient = redisClient;
        assert.ok(mongoDbClient);

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
    },

    'should init & stop': function(done) {
      var TESTCUID = 'testcuid';
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
          post: {
            'a': '1',
            'user': '1'
          }
        }]
      };
      async.series([
        async.apply(sync.api.connect, mongoDBUrl, {}, null),
        async.apply(sync.api.init, DATASETID, {}),
        async.apply(sync.api.invoke, DATASETID, params),
        async.apply(sync.api.stop, DATASETID),
        function checkSyncCallFailed(callback){
          sync.api.invoke(DATASETID, params, function(err){
            assert.ok(err);
            assert.ok(err.message.match(/stopped/ig));
            callback();
          });
        },
        async.apply(sync.api.init, DATASETID, {}),
        async.apply(sync.api.invoke, DATASETID, params)
      ], function(err){
        assert.ok(!err);
        done();
      });
    }
  }
};