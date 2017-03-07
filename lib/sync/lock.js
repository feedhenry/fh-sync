var mongoLock = require('mongodb-lock');

var locks = {};

function findOrCreate(mongoClient, collectionName, lockName, timeout) {
  if(locks[lockName]) {
    return locks[lockName];
  }
  // Lock doesn't exist, create it.
  var lockOptions = {
    timeout: timeout,
    removeExpired: true
  }
  var lock = mongoLock(mongoClient, collectionName, lockName, lockOptions);
  locks[lockName] = lock;
  return lock;
}

module.exports = function(mongoClient, collectionName) {
  collectionName = collectionName || 'sync_locks';
  return {
    acquire: function acquire(lockName, timeout, cb) {
      var lock = findOrCreate(mongoClient, collectionName, lockName, timeout);
      //this is important to ensure only 1 active lock at a time
      lock.ensureIndexes(function(){
        return lock.acquire(cb);
      });
    },

    release: function release(lockName, lockCode, cb) {
      var lock = locks[lockName];
      if (lock) {
        return lock.release(lockCode, cb)
      }
      return cb(new Error('Cannot release lock that does not exist'));
    }
  }
};