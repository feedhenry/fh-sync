var redis = require("redis");
var Memcached = require('memcached');

var redisPort = 6379;
var redisHost = '127.0.0.1';
var redisPassword;
var redisClient;
var appname;
var logger;
var memcached;

var getEnvVarValue = function(name, default_value, type) {
  var value = process.env[name];
  if (value === null || value === '') {
    return default_value;
  }
  try {
    if (type === String) {
      return value;
    } else {
      return JSON.parse(value); // works for boolean, number, array & object;
    }
  } catch (e) {
    if(logger && logger.error) {
      logger.error('fh.cache excpetion parsing env var. Using default value');
      logger.error('name=' + name + 'value=' + value + 'default_value=' + default_value + 'type=' + type + 'exception=' + e);
      console.error(e);
      return default_value;
    }
  }
};

var jdgClient = function() {
  // using default values of the memcahe client, execpt when overridden by env vars
  var options = {
    maxKeySize: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_MAXKEYSIZE', 250, Number), // the maximum key size allowed.
    maxExpiration: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_MAXEXPIRATION', 2592000, Number), // the maximum expiration time of keys (in seconds).
    maxValue: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_MAXVALUE', 1048576, Number), // the maximum size of a value.
    poolSize: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_POOLSIZE', 10, Number), // the maximum size of the connection pool.
    algorithm: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_ALGORITHM', 'md5', String), // the hashing algorithm used to generate the hashRing values.
    reconnect: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_RECONNECT', 18000000, Number), // the time between reconnection attempts (in milliseconds).
    timeout: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_TIMEOUT', 5000, Number), // the time after which Memcached sends a connection timeout (in milliseconds).
    retries: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_RETRIES', 5, Number), // the number of socket allocation retries per request.
    failures: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_FAILURES', 5, Number), // the number of failed-attempts to a server before it is regarded as 'dead'.
    retry: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_RETRY', 30000, Number), // the time between a server failure and an attempt to set it up back in service.
    remove: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_REMOVE', false, Boolean), // if true, authorizes the automatic removal of dead servers from the pool.
    failOverServers: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_FAILOVERSERVERS', undefined, Array), // an array of server_locations to replace servers that fail and that are removed from the consistent hashing scheme.
    keyCompression: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_KEYCOMPRESSION', true, Boolean), // whether to use md5 as hashing scheme when keys exceed maxKeySize.
    idle: getEnvVarValue('FHCACHE_MEMCACHE_CLIENT_IDLE', 5000, Number) // the idle timeout for the connections.
  };
  memcached = new Memcached(process.env.JDG_SERVICE_HOSTNAME + ':' + process.env.JDG_SERVICE_PORT, options);
};

var redisClient = function() {
  var client = redis.createClient(redisPort, redisHost);
  if (redisPassword) {
    client.auth(redisPassword);
  }
  return client;
};

module.exports = function(cfg){
  if (!cfg){
    return;
  }

  logger = cfg.logger;
  appname = cfg.fhapi.appname;

  // DynoFarm overrides
  if (cfg && cfg.redis) {
    if (cfg.redis.host) redisHost = cfg.redis.host;
    if (cfg.redis.port) redisPort = cfg.redis.port;
    if (cfg.redis.password) redisPassword = cfg.redis.password;
  }

  redisPort = parseInt(redisPort, 10);
  if (isNaN(redisPort)){
    redisPort = 6379;
  }

  if (process.env.JDG_SERVICE_PORT && process.env.JDG_SERVICE_PORT !== '' && process.env.JDG_SERVICE_HOSTNAME && process.env.JDG_SERVICE_HOSTNAME !== '') {
    jdgClient();
    return jdgCache;
  } else {
    return redisCache;
  }
}


// opts.act: can be one of 'save/load/remove'
// opts.key: the key
// opts.value: the value
// opts.expire: the cache expiry value
var jdgCache = function(opts, callback) {
  if (callback === undefined) {
    throw new Error('callback undefined in $fh.cache. See documentation of $fh.cache for proper usage');
  }

  if (opts.act === undefined){
    return callback('No cache actions defined!');
  }

  var fullKey = appname + opts.key;

  if (opts.act === 'save') {
    memcached.set(fullKey, opts.value, opts.expire || 0, function (err) {
      if (err) return callback(err);
      // To keep the same api response as redis implemenation, use 'OK' if successfully saved
      return callback(null, 'OK');
    });
  } else if (opts.act === 'load') {
    memcached.get(fullKey, function(err, data) {
      // To keep the same api response as redis implemenation, use null instead of undefined
      if (err) return callback(err);
      return callback(null, data || null);
    });
  } else if (opts.act === 'remove') {
    memcached.del(fullKey, function (err) {
      if (err) return callback(err);
      // To keep the same api response as redis implementation, use null & 1 if successfully removed
      return callback(null, 1);
    });
  } else {
    return callback("Unknown cache action: " + opts.act);
  }
};

// opts.act: can be one of 'save/load/remove'
// opts.key: the key
// opts.value: the value
// opts.expire: the cache expiry value
var redisCache = function(opts, callback) {
  if (callback === undefined) {
    throw new Error('callback undefined in $fh.cache. See documentation of $fh.cache for proper usage');
  }

  if (opts.act === undefined){
    return callback('No cache actions defined!');
  }

  var fullKey = appname + opts.key;

  var client = redisClient();
  if (opts.act === 'save') {
    client.on("connect", function () {
      if (redisPassword) {
        client.auth(redisPassword, function(err) {
          if (err) callback(err);
        });
      }
    });
    client.on("error", function (err) {
      if(logger && logger.error) {
        logger.error("fh.cache error ", err);
      }
      return callback(err);
    });
    client.on("ready", function (err) {
      if (err) return callback(err);
      if (opts.expire !== undefined) {
        client.setex(fullKey, opts.expire, opts.value, function (err, reply) {
          client.quit();
          return callback(err, reply);
        });
      }else {
        client.set(fullKey, opts.value, function (err, reply) {
          client.quit();
          return callback(err, reply);
        });
      }
    });
  }else if (opts.act === 'load') {
    client.on("connect", function () {
      if (redisPassword) {
        client.auth(redisPassword, function(err) {
          if (err) callback(err);
        });
      }
    });
    client.on("error", function (err) {
      if(logger && logger.error) {
        logger.error("fh.cache error ", err);
      }
      callback(err);
      client.end();
    });
    client.on("ready", function (err) {
      if (err) return callback(err);
      client.get(fullKey, function(err, reply) {
        client.quit();
        return callback(err, reply);
      });
    });
  }else if (opts.act === 'remove') {
    client.on("connect", function () {
      if (redisPassword) {
        client.auth(redisPassword, function(err) {
          if (err) callback(err);
        });
      }
    });
    client.on("error", function (err) {
      if(logger && logger.error) {
        logger.error("fh.cache error ", err);
      }
      return callback(err);
    });
    client.on("ready", function (err) {
      if (err) return callback(err);
      client.del(fullKey, function(err, reply) {
        client.quit();
        return callback(err, reply);
      });
    });
  }else {
    return callback("Unknown cache action: " + opts.act);
  }
};
