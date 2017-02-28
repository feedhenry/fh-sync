var sync = require('../../lib/sync');
var assert = require('assert');
var util = require('util');
var async = require('async');

var mClient;
var rClient;

module.exports = {
  'test sync connect': {
    'should connect ok': function(finish) {
      // assume redis & mongodb on localhost with default ports

      // mongodb://localhost:50000,localhost:50001/myproject
      var mongoDBUrl = 'mongodb://127.0.0.1:27017';

      sync.api.connect(mongoDBUrl, null, {}, function(err, mongoDbClient, redisClient) {
        assert.ok(!err, util.inspect(err));
        mClient = mongoDbClient;
        rClient = redisClient;
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
    }
  }
};