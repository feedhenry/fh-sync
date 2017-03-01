var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var _ = require('underscore');
var defaultDataHandlersModule = require('../../lib/sync/default-dataHandlers');
var dataHandlersModule = require('../../lib/sync/dataHandlers');

var DATASETID = "collisionHandlersTest";
var MONGODB_URL = "mongodb://127.0.0.1:27017/test";

var mongodb;
var dataHandlers;

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
  'before': function(done) {
    MongoClient.connect(MONGODB_URL, function(err, db){
      if (err) {
        console.log('mongodb connection error', err);
        return done(err);
      }
      mongodb = db;
      mongodb.dropCollection(DATASETID + '_collision');
      dataHandlers = dataHandlersModule({
        defaultHandlers: defaultDataHandlersModule(mongodb)
      });
      return done(err);
    });
  },
  'afterEach': function(done) {
    mongodb.dropCollection(DATASETID + '_collision');
    dataHandlers = dataHandlersModule({
      defaultHandlers: defaultDataHandlersModule(mongodb)
    });
    return done();
  },
  'test default create and list collisions': function(done) {
    var collisionData = getCollisionData();
    dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
      assert.ok(!err);
      dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
        var collision = _.values(res)[0];
        assert.equal(1, _.size(res));
        assert.equal(collisionData.hash, collision.hash);
        assert.deepEqual(collisionData, collision);
        done(err);
      });
    });
  },
  'test default removing collisions': function(done) {
    var collisionData = getCollisionData();
    dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
      dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
        var collisionId = Object.keys(res)[0];
        var collision = _.values(res)[0];
        assert.equal(1, _.size(res));
        dataHandlers.removeCollision(DATASETID, collisionId, {}, function(err, res) {
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
    var stringData;
    dataHandlers.collisionHandler(DATASETID, function(datasetId, metaData, collisionData, cb) {
      var stringData = JSON.stringify(collisionData);
      var collision = { data: stringData };
      mongodb.collection(DATASETID + '_collision').insertOne(collision, function(err, res) {
        assert.ok(!err);
        return cb(err, res.ops[0]);
      });
    });
    var collisionData = getCollisionData();
    dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
      assert.ok(!err);
      assert(res.data, stringData);
      return done();
    });
  },
  'test custom list collision': function(done) {
    var stubList = ['stubbed', 'list'];
    dataHandlers.listCollisionsHandler(DATASETID, function(datasetId, metaData, cb) {
      return cb(null, stubList);
    });
    dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
      assert.ok(!err);
      assert.deepEqual(stubList, res);
      return done();
    });
  },
  'test custom remove collision': function(done) {
    dataHandlers.removeCollisionHandler(DATASETID, function(datasetId, dataHash, metaData, cb) {
      return mongodb.collection(DATASETID + '_collision').remove({hash: dataHash}, cb);
    });
    var collisionData = getCollisionData();
    dataHandlers.handleCollision(DATASETID, {}, collisionData, function(err, res) {
      dataHandlers.removeCollision(DATASETID, collisionData.hash, {}, function(err, res) {
        dataHandlers.listCollisions(DATASETID, {}, function(err, res) {
          assert.ok(!err);
          assert.deepEqual({}, res);
          return done();
        });
      });
    });
  }
};