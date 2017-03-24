var redisClient;
var syncConfig;

/**
 * Save data to the cache
 * @param {String} key 
 * @param {String} value 
 * @param {Function} cb
 */
function set(key, value, cb) {
  if (!syncConfig.useCache || !redisClient) {
    return cb && cb();
  }
  return redisClient.set(key, value, cb);
}

/**
 * Read data from cache
 * @param {String} key 
 * @param {Function} cb 
 */
function get(key, cb) {
  if (!syncConfig.useCache || !redisClient) {
    return cb && cb();
  }
  return redisClient.get(key, cb);
}

/**
 * Delete data from cache
 * @param {String} key 
 * @param {Function} cb
 */
function del(key, cb) {
  if (!syncConfig.useCache || !redisClient) {
    return cb && cb();
  }
  return redisClient.del(key, cb);
}

module.exports = function(syncConfigInst, redisClientImpl) {
  syncConfig = syncConfigInst || {};
  redisClient = redisClientImpl;
  return {
    set: set,
    get: get,
    del: del
  };
};