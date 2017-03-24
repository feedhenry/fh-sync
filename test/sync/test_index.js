var assert = require('assert');
var sync = require('../../lib/sync/index.js');
var sinon = require('sinon');

module.exports = {
  'test invoke arg validation' : function() {
    assert.throws(function() {
      sync.api.invoke();
    }, function(err) {
      assert.equal(err.message, 'invoke requires 3 arguments');
      return true;
    });

    assert.throws(function() {
      sync.api.invoke('test_dataset_id');
    }, function(err) {
      assert.equal(err.message, 'invoke requires 3 arguments');
      return true;
    });

    assert.throws(function() {
      sync.api.invoke('test_dataset_id', {});
    }, function(err) {
      assert.equal(err.message, 'invoke requires 3 arguments');
      return true;
    });
  },

  'test invoke with missing fn': function(finish) {
    sync.api.invoke('test_dataset_id', {}, function(err) {
      assert.equal(err, 'no fn parameter provided in params "{}"');
      return finish();
    });
  },

  'test invoke with invalid fn': function(finish) {
    var params = {
      fn: 'some_invalid_fn'
    };

    sync.api.invoke('test_dataset_id', params, function(err) {
      assert.equal(err, 'invalid fn parameter provided in params "some_invalid_fn"');
      return finish();
    });
  },

  'test connect arg validation' : function() {
    assert.throws(function() {
      sync.api.connect();
    }, function(err) {
      assert.equal(err.message, 'connect requires 4 arguments');
      return true;
    });

    assert.throws(function() {
      sync.api.connect('test_mongodb_url');
    }, function(err) {
      assert.equal(err.message, 'connect requires 4 arguments');
      return true;
    });

    assert.throws(function() {
      sync.api.connect('test_mongodb_url', 'test_redis_url');
    }, function(err) {
      assert.equal(err.message, 'connect requires 4 arguments');
      return true;
    });
  },

  'test public APIs': function() {
    assert.equal(typeof sync.api.init, 'function');
    assert.equal(typeof sync.api.invoke, 'function');
    assert.equal(typeof sync.api.stop, 'function');
    assert.equal(typeof sync.api.stopAll, 'function');
    assert.equal(typeof sync.api.connect, 'function');
    assert.equal(typeof sync.api.setConfig, 'function');
    assert.equal(typeof sync.api.toJSON, 'function');
    assert.equal(typeof sync.api.globalInterceptRequest, 'function');
    assert.equal(typeof sync.api.globalInterceptResponse, 'function');
    assert.equal(typeof sync.api.interceptRequest, 'function');
    assert.equal(typeof sync.api.interceptResponse, 'function');
    assert.equal(typeof sync.api.globalHandleList, 'function');
    assert.equal(typeof sync.api.globalHandleCreate, 'function');
    assert.equal(typeof sync.api.globalHandleRead, 'function');
    assert.equal(typeof sync.api.globalHandleUpdate, 'function');
    assert.equal(typeof sync.api.globalHandleDelete, 'function');
    assert.equal(typeof sync.api.globalHandleCollision, 'function');
    assert.equal(typeof sync.api.globalListCollisions, 'function');
    assert.equal(typeof sync.api.globalRemoveCollision, 'function');
    assert.equal(typeof sync.api.handleList, 'function');
    assert.equal(typeof sync.api.handleCreate, 'function');
    assert.equal(typeof sync.api.handleRead, 'function');
    assert.equal(typeof sync.api.handleUpdate, 'function');
    assert.equal(typeof sync.api.handleDelete, 'function');
    assert.equal(typeof sync.api.handleCollision, 'function');
    assert.equal(typeof sync.api.listCollisions, 'function');
    assert.equal(typeof sync.api.removeCollision, 'function');
  }
};