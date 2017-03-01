var assert = require('assert');
var sinon = require('sinon');
var dataHandlersModule = require('../../lib/sync/dataHandlers.js');

var id = 'datahandlers_test';
var queryParams = {};
var metaData = {};

var defaultHandlers = {
  doList: sinon.stub().yields(),
  doCreate: sinon.stub().yields(),
  doRead: sinon.stub().yields(),
  doUpdate: sinon.stub().yields(),
  doDelete: sinon.stub().yields(),
  handleCollision: sinon.stub().yields(),
}

module.exports = {

  'test no options passed to module should throw error': function(done) {
    verifyMissingOptions(undefined, done);
  },

  'test no defaultHandlers passed to module should throw error': function(done) {
    verifyMissingOptions({}, done);
  },

  'test set custom listHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.listHandler(id, function (datasetId, queryparams, metadata, cb) {
      cb(null, 'dummy record');
    });

    dataHandlers.doList(id, queryParams, metaData, function(err, records) {
      assert.ok(!err);
      assert.equal(records, 'dummy record');
      done();
    });
  },

  'test set custom createHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.createHandler(id, function (datasetId, queryparams, metadata, cb) {
      cb(null, 'dummy data');
    });

    dataHandlers.doCreate(id, queryParams, metaData, function(err, data) {
      assert.ok(!err);
      assert.equal(data, 'dummy data');
      done();
    });
  },

  'test set custom readHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.readHandler(id, function (datasetId, uid, metadata, cb) {
      cb(null, 'dummy data');
    });

    dataHandlers.doRead(id, '123', metaData, function(err, data) {
      assert.ok(!err);
      assert.equal(data, 'dummy data');
      done();
    });
  },

  'test set custom updateHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.updateHandler(id, function (datasetId, uid, record, metadata, cb) {
      cb(null);
    });

    dataHandlers.doUpdate(id, '123', 'record', metaData, function(err) {
      assert.ok(!err);
      done();
    });
  },

  'test set custom deleteHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.deleteHandler(id, function (datasetId, uid, metadata, cb) {
      cb(null);
    });

    dataHandlers.doDelete(id, '123', metaData, function(err) {
      assert.ok(!err);
      done();
    });
  },

  'test set custom collisionHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.collisionHandler(id, function (datasetId, metadata, collisionFields, cb) {
      cb(null);
    });

    dataHandlers.handleCollision(id, metaData, [], function(err) {
      assert.ok(!err);
      done();
    });
  },

  'test set default listHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.doList(id, queryParams, metaData, function(err, records) {
      assert.ok(defaultHandlers.doList.called);
      done();
    });
  },

  'test set default createHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.doCreate(id, queryParams, metaData, function(err, records) {
      assert.ok(defaultHandlers.doCreate.called);
      done();
    });
  },

  'test set default readHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.doRead(id, '123', metaData, function(err, records) {
      assert.ok(defaultHandlers.doRead.called);
      done();
    });
  },

  'test set default updateHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.doUpdate(id, '123', 'pendingChange', metaData, function(err) {
      assert.ok(defaultHandlers.doUpdate.called);
      done();
    });
  },

  'test set default deleteHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.doDelete(id, '123', metaData, function(err) {
      assert.ok(defaultHandlers.doDelete.called);
      done();
    });
  },

  'test set default collisionHandler': function(done) {
    var dataHandlers = dataHandlersModule({defaultHandlers: defaultHandlers});
    dataHandlers.handleCollision(id, metaData, [],  function(err) {
      assert.ok(defaultHandlers.handleCollision.called);
      done();
    });
  }

};

function verifyMissingOptions(options, done) {
    assert.throws(function() {
      dataHandlersModule(options);
    }, function(err) {
      assert.equal(err.message, 'Default handlers were not passed in options.');
      done();
      return true;
    });
}
