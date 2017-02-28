var assert = require('assert');
var sinon = require('sinon');
var defaultDataHandlersModule = require('../../lib/sync/default-dataHandlers.js');

var id = 'datahandler_test';
var queryParams = {};
var metaData = {};

// stubs when there is no real MongoDB
var collectionStub = {
  insertOne: sinon.stub().yields(null, {
    result: { ok: 1, n: 1},
    ops: [ {'_id': '58b3d9efde2810043a0ac99d', 'name': 'Fletch'}],
    connection: null,
    insertedCount: 1,
    insertedId: '58b3d9efde2810043a0ac99d'}),
  find: sinon.stub().returns({
    toArray: sinon.stub().yields(null, [{
      "_id": '58b3d9efde2810043a0ac99d'}]),
  }),
  findOne: sinon.stub().yields(null, {
    "_id": '58b3d9efde2810043a0ac99d'
  }),
  updateOne: sinon.stub().yields(null),
  remove: sinon.stub().callsArgWith(1, null, {
    result: { ok: 1, n: 1}
  }),
  drop: sinon.stub()
};
var dbStub = {
  collection: sinon.stub().withArgs(id).returns(collectionStub)
};

var url = 'mongodb://localhost:27017/dataHandlersTest';
var MongoClient = require('mongodb').MongoClient;

module.exports = {

  'test defaultDataHandlers module constructor': function(done) {
    assert.throws(function() {
      defaultDataHandlersModule();
    }, function(err) {
      assert.equal(err.message, 'MongoDB instance must be passed to module.');
      done();
      return true;
    });
  },

  'test doCreate': function(done) {
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      var data = {'name': 'Fletch'};
      dataHandlers.doCreate(id, data, metaData, function(err, res) {
        assert.ok(!err);
        assert.ok(res.uid);
        assert.equal(res.data.name, 'Fletch');
        db.collection(id).drop();
        done();
      });
    });
  },

  'test doList': function(done) {
    const that = this;
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      dataHandlers.doCreate(id, queryParams, metaData, function(err, res) {
        var uid = res.insertedId;
        dataHandlers.doList(id, queryParams, metaData, function(err, res) {
          assert.ok(!err);
          assert.ok(res[0]);
          db.collection(id).drop();
          done();
        });
      });
    });
  },

  'test doRead': function(done) {
    const that = this;
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      dataHandlers.doCreate(id, queryParams, metaData, function(err, res) {
        var uid = res.uid;
        dataHandlers.doRead(id, uid, metaData, function(err, res) {
          assert.ok(!err);
          assert.ok(res._id);
          db.collection(id).drop();
          done();
        });
      });
    });
  },

  'test doUpdate': function(done) {
    const that = this;
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      dataHandlers.doCreate(id, queryParams, metaData, function(err, res) {
        var uid = res.uid;
        dataHandlers.doUpdate(id, uid, {name: "Doe"}, metaData, function(err) {
          assert.ok(!err);
          db.collection(id).drop();
          done();
        });
      });
    });
  },

  'test doDelete': function(done) {
    const that = this;
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      dataHandlers.doCreate(id, queryParams, metaData, function(err, res) {
        var uid = res.uid;
        dataHandlers.doDelete(id, uid, metaData, function(err, res) {
          assert.ok(!err);
          db.collection(id).drop();
          done();
        });
      });
    });
  },

  'test handleCollision': function(done) {
    const that = this;
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      dataHandlers.handleCollision(id, metaData, {'name': 'Doe'}, function(err, res) {
        assert.ok(!err);
        assert.equal(res.result.ok, 1);
        assert.equal(res.insertedCount, 1);
        assert.ok(res.insertedId);
        db.collection(id + '_collision').drop();
        done();
      });
    });
  },

  'test listCollisions': function(done) {
    const that = this;
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      dataHandlers.handleCollision(id, metaData, {'name': 'Doe'}, function(err, res) {
        assert.ok(!err);
        dataHandlers.listCollisions(id, metaData, function(err, res) {
          db.collection(id + '_collision').drop();
          done();
        });
      });
    });
  },

  'test removeCollision': function(done) {
    const that = this;
    MongoClient.connect(url, function(err, db) {
      db = err ? dbStub : db;
      var dataHandlers = defaultDataHandlersModule(db);
      dataHandlers.handleCollision(id, metaData, {'name': 'Doe'}, function(err, res) {
        assert.ok(!err);
        var uid = res.insertedId;
        dataHandlers.removeCollision(id, uid, metaData, function(err, res) {
          assert.equal(res.result.ok, 1);
          assert.equal(res.result.n, 1);
          db.collection(id + '_collision').drop();
          done();
        });
      });
    });
  }

};
