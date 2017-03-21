var syncUtil = require('./util');
var metricsModule = require('./sync-metrics');
var _ = require('underscore');
var server = require('./sync-server');
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var redis = require('redis');
var async = require('async');
var eventEmitter = new (require('events').EventEmitter)();
function toJSON(dataset_id, returnData, cb) {
  syncUtil.doLog(dataset_id, 'debug', 'toJSON');

  // TODO

  return cb(null, {});
}

/**
 * Connect to mongodb & redis with the given connection urls.
 * This should be called before `start()` is called
 *
 * @param {string} mongoDBConnectionUrl A MongoDB connection uril in a format supported by the `mongodb` module
 * @param {Object} mongoDBConnectionOption mongodb connection options.
 * @param {string} redisUrl A redis connection url in a format supported by the `redis` module
 * @param {function} cb
 */
function connect(mongoDBConnectionUrl, mongoDBConnectionOption, redisUrl, cb) {
  if (arguments.length < 4) throw new Error('connect requires 4 arguments');

  async.series([
    function connectToMongoDB(callback) {
      MongoClient.connect(mongoDBConnectionUrl, mongoDBConnectionOption || {}, callback);
    },
    function connectToRedis(callback) {
      if (redisUrl) {
        var redisOpts = {
          url: redisUrl
        };
        var client = redis.createClient(redisOpts);
        return callback(null, client);
      } else {
        return callback();
      }
    }
  ], function(err, results) {
    if (err) return cb(err);
    var mongoDbClient = results[0];
    var redisClient = results[1];

    server.setClients(mongoDbClient, redisClient);

    eventEmitter.emit('sync:ready');
    return cb(null, mongoDbClient, redisClient);
  });
}

function setLogLevel(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'debug', 'setLogLevel');
  if (params && params.logLevel) {
    syncUtil.doLog(dataset_id, 'debug', 'Setting logLevel to "' + params.logLevel + '"');
    syncUtil.setLogger(dataset_id, params);
    cb && cb(null, {"status": "ok"});
  } else {
    cb && cb('logLevel parameter required');
  }
}

function getEventEmitter() {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'getEventEmitter');
  return eventEmitter;
}

function setEventEmitter(emitter) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'debug', 'setEventEmitter');
  eventEmitter = emitter;
}

/** @type {Array} Functions that are allowed to be invoked */
var invokeFunctions = ['sync', 'syncRecords', 'listCollisions', 'removeCollision', 'setLogLevel'];

/** Invoke the Sync Server. */
function invoke(dataset_id, params, callback) {
  syncUtil.doLog(dataset_id, 'info', 'invoke');

  if (arguments.length < 3) throw new Error('invoke requires 3 arguments');

  // Verify that fn param has been passed
  if (!params || !params.fn) {
    var err = 'no fn parameter provided in params "' + util.inspect(params) + '"';
    syncUtil.doLog(dataset_id, 'warn', err, params);
    return callback(err, null);
  }

  var fn = params.fn;

  // Verify that fn param is valid
  if (invokeFunctions.indexOf(fn) < 0) {
    return callback('invalid fn parameter provided in params "' + fn + '"', null);
  }

  var fnHandler =  module.exports[fn] || server[fn] || server.api[fn];

  server.api.start(function(err) {
    if (err) {
      return callback(err);
    }
    return fnHandler(dataset_id, params, callback);
  });
}

// extend from empty object to force copy, and because last source overrides the previous ones
module.exports = _.extend({}, server, {
  sync: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.sync),
  syncRecords: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.syncRecords),
  listCollisions: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.api.listCollisions),
  removeCollision: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.api.removeCollision),
  setLogLevel: setLogLevel,
  api: _.extend({}, server.api, {
    connect: connect,
    invoke: invoke,
    toJSON: toJSON,
    setLogLevel: setLogLevel,
    getEventEmitter: getEventEmitter,
    setEventEmitter: setEventEmitter,
  })
});

//Expose the handler overrides as part of the API. Each key is the name of the public interface, and the value is the name of function in dataHandlers
var handlerOverrides = {
  'globalHandleList': 'globalListHandler',
  'globalHandleCreate': 'globalCreateHandler',
  'globalHandleRead': 'globalReadHandler',
  'globalHandleUpdate': 'globalUpdateHandler',
  'globalHandleDelete': 'globalDeleteHandler',
  'globalHandleCollision': 'globalCollisionHandler',
  'globalListCollisions': 'globalListCollisionsHandler',
  'globalRemoveCollision': 'globalRemoveCollisionHandler',
  'handleList': 'listHandler',
  'handleCreate': 'createHandler',
  'handleRead': 'readHandler',
  'handleUpdate': 'updateHandler',
  'handleDelete': 'deleteHandler',
  'handleCollision': 'collisionHandler',
  'listCollisions': 'listCollisionsHandler',
  'removeCollision': 'removeCollisionHandler'
};

_.each(handlerOverrides, function(target, methodName) {
  module.exports.api[methodName] = function() {
    server.api.callHandler(target, arguments);
  };
});
