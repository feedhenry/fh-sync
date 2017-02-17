var SyncScheduler = require('../../lib/sync/sync-scheduler').SyncScheduler;
var assert = require('assert');

module.exports = {
  'test create arg validation': function() {
    var scheduler = null;

    assert.throws(function() {
      sheduler = new SyncScheduler();
    }, function(err) {
      assert.equal(err.message, 'SyncScheduler constructor requires 2 arguments');
      return true;
    });

    assert.throws(function() {
      sheduler = new SyncScheduler({});
    }, function(err) {
      assert.equal(err.message, 'SyncScheduler constructor requires 2 arguments');
      return true;
    });
  }
};