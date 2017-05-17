var assert = require('assert');
var sinon = require('sinon');
var defaultDataHandlersModule = require('../lib/default-dataHandlers.js');

var id = 'datahandler_test';
var queryParams = {};
var metaData = {};
var stubUid = '58b3d9efde2810043a0ac99d';
var retObject = {'_id': stubUid, 'name': 'Fletch'};

// stubs when there is no real MongoDB
var collectionStub = {
  insertOne: sinon.stub().yields(null, {
    ops: [retObject]}),
  find: sinon.stub().returns({
    toArray: sinon.stub().yields(null, [retObject]),
  }),
  findOne: sinon.stub().yields(null, {
    "_id": stubUid
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

function resetStubUid() {
  retObject._id = stubUid;
}

module.exports = {

  'beforeEach': function(){
    resetStubUid();
  },

  'test doCreate': function(done) {
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    var data = {'name': 'Fletch'};
    dataHandlers.doCreate(id, data, metaData, function(err, res) {
      assert.ok(!err);
      assert.ok(res.uid);
      assert.equal(res.data.name, 'Fletch');
      dbStub.collection(id).drop();
      done();
    });
  },

  'test doList': function(done) {
    const that = this;
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    var data = {'name': 'Fletch'};
    dataHandlers.doCreate(id, data, metaData, function(err, res) {
      var uid = res.uid || stubUid;
      resetStubUid();
      dataHandlers.doList(id, queryParams, metaData, function(err, res) {
        assert.ok(!err);
        assert.ok(res);
        assert.ok(res[uid]);
        assert.equal(res[uid].name, 'Fletch');
        dbStub.collection(id).drop();
        done();
      });
    });
  },

  'test doRead': function(done) {
    const that = this;
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    dataHandlers.doCreate(id, queryParams, metaData, function(err, res) {
      var uid = res.uid || stubUid;
      dataHandlers.doRead(id, uid, metaData, function(err, res) {
        assert.ok(!err);
        assert.ok(!res._id);
        dbStub.collection(id).drop();
        done();
      });
    });
  },

  'test doUpdate': function(done) {
    const that = this;
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    dataHandlers.doCreate(id, queryParams, metaData, function(err, res) {
      var uid = res.uid || stubUid;
      dataHandlers.doUpdate(id, uid, {name: "Fletch"}, metaData, function(err) {
        assert.ok(!err);
        dbStub.collection(id).drop();
        done();
      });
    });
  },

  'test doDelete': function(done) {
    const that = this;
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    dataHandlers.doCreate(id, queryParams, metaData, function(err, res) {
      var uid = res.uid || stubUid;
      dataHandlers.doDelete(id, uid, metaData, function(err, res) {
        assert.ok(!err);
        dbStub.collection(id).drop();
        done();
      });
    });
  },

  'test handleCollision': function(done) {
    const that = this;
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    dataHandlers.handleCollision(id, null, Date.now(), null, {}, {}, metaData, function(err, res) {
      var uid = res.uid || stubUid;
      assert.ok(!err);
      assert.ok(res.uid);
      assert.ok(res.data);
      dbStub.collection(id + '_collision').drop();
      done();
    });
  },

  'test listCollisions': function(done) {
    const that = this;
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    dataHandlers.handleCollision(id, null, Date.now(), null, {}, {}, metaData, function(err, res) {
      var uid = res.uid || stubUid;
      assert.ok(!err);
      resetStubUid();
      dataHandlers.listCollisions(id, metaData, function(err, res) {
        assert.ok(res);
        assert.ok(res[uid]);
        dbStub.collection(id + '_collision').drop();
        done();
      });
    });
  },

  'test removeCollision': function(done) {
    const that = this;
    var dataHandlers = defaultDataHandlersModule();
    dataHandlers.setMongoDB(dbStub);
    dataHandlers.handleCollision(id, null, Date.now(), null, {}, {}, metaData, function(err, res) {
      assert.ok(!err);
      var uid = res.insertedId;
      dataHandlers.removeCollision(id, uid, metaData, function(err, res) {
        dbStub.collection(id + '_collision').drop();
        done();
      });
    });
  }

};
