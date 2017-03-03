var assert = require('assert');
var sync = require('../../lib/sync/index.js')
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

  'test start with connect called': function() {
    // TODO
  }
};