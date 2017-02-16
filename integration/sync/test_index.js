var sync = require('../../lib/sync');
var assert = require('assert');
var util = require('util');
var async = require('async');

var mClient;
var rClient;

module.exports = {
  'test sync connect': {
    'afterEach': function() {
      if (mClient) {
        try {
          mClient.close();
        } catch (e) {
          console.warn('Execption in test sync connect after', e);
        }
        mClient = null;
      }
      if (rClient) {
        try {
          rClient.end(true);
        } catch (e) {
          console.warn('Execption in test sync connect after', e);
        }
        rClient = null;
      }
    },

    'should connect ok': function(finish) {
      // assume redis & mongodb on localhost with default ports

      // mongodb://localhost:50000,localhost:50001/myproject
      var mongoDBUrl = 'mongodb://127.0.0.1:27017';
      
      // [redis:]//[[user][:password@]][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]] (More info avaliable at IANA).
      var redisUrl = 'redis://127.0.0.1:6379';

      sync.api.connect(mongoDBUrl, redisUrl, function(err, mongoDbClient, redisClient) {
        assert.ok(!err, util.inspect(err));
        mClient = mongoDbClient;
        rClient = redisClient;
        assert.ok(mongoDbClient);
        assert.ok(redisClient);

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
        }, function testRedisConnection(cb) {
          var testKey = 'test_connect_' + Date.now();
          var testValue = 'test value';
          rClient.set(testKey, testValue, function(err) {
            assert.ok(!err, util.inspect(err));
            rClient.get(testKey, function(err, value) {
              assert.equal(value, testValue);
              return cb();
            });
          })
        }], function(err) {
          assert.ok(!err, util.inspect(err));
          return finish();
        });
      });
    }
  }
};