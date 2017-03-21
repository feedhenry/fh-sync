var async = require('async');
var assert = require('assert');
var sinon = require('sinon');
var _ = require('underscore');
var defaultDataHandlersModule = require('../../lib/sync/default-dataHandlers');
var dataHandlersModule = require('../../lib/sync/dataHandlers');
var sync = require('../../lib/sync/');

var DATASETID = "collisionHandlersTest";
var MONGODB_URL = "mongodb://127.0.0.1:27017/test_collision";

var mongodb;
var dataHandlers;
var defaultHandlers;

function getCollisionData() {
  return {
    pre: { test: 'test1' },
    post: { test: 'test2' },
    hash: 'testhash',
    ts: Date.now(),
    uid: 'testUid'
  };
}

module.exports = {
  'test collision handlers': {
    'before': function(done) {
      sync.api.connect(MONGODB_URL, {}, null, function(err, mongoClient, redisClient) {
        mongodb = mongoClient;
        mongodb.dropCollection(DATASETID + '_collision');
        defaultHandlers = defaultDataHandlersModule(mongodb);
        dataHandlers = dataHandlersModule({
          defaultHandlers: defaultHandlers
        });
        return done(err);
      });
    },
    'after': function(done) {
      sync.api.stopAll(done);
    },
    'afterEach': function(done) {
      dataHandlers = dataHandlersModule({
        defaultHandlers: defaultDataHandlersModule(mongodb)
      });
      mongodb.dropCollection(DATASETID + '_collision', function(){
        return done();
      });
    },
    'test default create and list collisions': function(done) {
      var collisionData = getCollisionData();
      dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
        assert.ok(!err);
        dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
          var collision = _.values(res)[0];
          assert.equal(1, _.size(res));
          assert.deepEqual(collisionData, collision);
          done(err);
        });
      });
    },
    'test default removing collisions': function(done) {
      var collisionData = getCollisionData();
      dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
        dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
          var collision = _.values(res)[0];
          assert.equal(1, _.size(res));
          dataHandlers.removeCollision(DATASETID, collision.hash, {}, function(err, res) {
            dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
              assert.ok(!err);
              assert.equal(0, _.size(res));
              return done();
            });          
          });
        });
      });
    },
    'test custom create collision': function(done) {
      // Wrap the default handler, as long as we know a custom one is called.
      var customHandler = sinon.spy(defaultHandlers, 'handleCollision');
      dataHandlers.collisionHandler(DATASETID, customHandler);

      var collisionData = getCollisionData();
      dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err) {
        assert.ok(!err);
        assert.ok(customHandler.calledOnce);
        return done();
      });
    },
    'test custom list collision': function(done) {
      var customHandler = sinon.spy(defaultHandlers, 'listCollisions');
      dataHandlers.listCollisionsHandler(DATASETID, customHandler);
      dataHandlers.listCollisions(DATASETID, {}, function(err) {
        assert.ok(!err);
        assert.ok(customHandler.calledOnce);
        return done();
      });
    },
    'test custom remove collision': function(done) {
      var customHandler = sinon.spy(defaultHandlers, 'removeCollision');
      dataHandlers.removeCollisionHandler(DATASETID, customHandler);
      var collisionData = getCollisionData();

      dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
        dataHandlers.removeCollision(DATASETID, collisionData.hash, {}, function(err) {
          assert.ok(!err);
          dataHandlers.listCollisions(DATASETID, {}, function(err) {
            assert.ok(!err);
            assert.ok(customHandler.calledOnce);
            return done();
          });
        });
      });
    },
    'test public api list collisions': function(done) {
      var collisionData = getCollisionData();
      dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err) {
        assert.ok(!err);
        sync.api.invoke(DATASETID, { fn: 'listCollisions' }, function(err, res) {
          var collision = _.values(res)[0];
          assert.equal(1, _.size(res));
          assert.deepEqual(collisionData, collision);
          done(err);
        });
      });     
    },
    'test public api remove collisions': function(done) {
      var collisionData = getCollisionData();
      dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
        assert.ok(!err);
        sync.api.invoke(DATASETID, { fn: 'removeCollision', hash: collisionData.hash }, function(err, res) {
          dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
            assert.equal(0, _.size(res));
            assert.deepEqual({}, res);
            done(err);
          });
        });
      });
    }
  }
};