var assert = require('assert');
var sinon = require('sinon');
var proxyquire = require('proxyquire');

var lockName = 'testOne';
var codeName = 'lockCode';

/**
 * mongodb-lock.Lock relies on MongoDB, we don't need to test this as it's
 * already being tested in its own repo. So just mock out expected responses.
 */
var mockMongoLock = function() {
  return {
    release: sinon.stub().yields(null, true),
    acquire: sinon.stub().yields(null, codeName)
  }
}

/**
 * Needed for the initialisation of mongodb-lock.Lock object.
 */
var mockMongo = {
  collection: sinon.stub()
}

var lockModule = proxyquire('../../lib/sync/lock', {
  'mongodb-lock': mockMongoLock
});

/**
 * There's not much to test here as it's just a wrapper around mongodb-lock.
 * Ensure that the lock is created in acquire and ensure release passes back 
 * the right value to the user (true or false).
 */
module.exports = {
  'test acquire': function(done) {
    var syncLockImpl = lockModule(mockMongo, 'sync_testing');

    syncLockImpl.acquire(lockName, 1000, function(err, code) {
      assert.ok(!err);
      assert.ok(code === codeName);
      return done();
    });
  },

  'test valid release': function(done) {
    var syncLockImpl = lockModule(mockMongo, 'sync_testing');

    syncLockImpl.acquire(lockName, 1000, function(err, code) {
      assert.ok(!err);
      assert.ok(code);
      syncLockImpl.release(lockName, code, function(err, res) {
        assert.ok(!err);
        assert.ok(res);
        return done();
      });
    });
  },
}