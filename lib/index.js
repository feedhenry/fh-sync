var syncUtil = require('./util');
var metricsModule = require('./sync-metrics');
var _ = require('underscore');
var server = require('./sync-server');
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var redis = require('redis');
var async = require('async');
var eventEmitter = new (require('events').EventEmitter)();
var debug=syncUtil.debug;
var debugError = syncUtil.debugError;
var syncConnected = false;

function toJSON(dataset_id, returnData, cb) {
  debug('[%s] toJSON',dataset_id);

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
      var redisOpts = {
        url: redisUrl
      };
      var client = redis.createClient(redisOpts);
      // We don't want the app to crash if Redis is not available.
      client.on('error', handleRedisError);
      return callback(null, client);
    }
  ], function(err, results) {
    if (err) {
      // If there was any problem with connecting to mongo or redis on startup,
      // the app should crash as its in an unknown state.
      throw err;
    }
    var mongoDbClient = results[0];
    var redisClient = results[1];

    server.setClients(mongoDbClient, redisClient);

    syncConnected = true;
    eventEmitter.emit('sync:ready');
    return cb(null, mongoDbClient, redisClient);
  });
}

/**
 * Handle any errors emitted by the Redis client. Without a listener
 * for the error event the process will exit when an event is emitted
 *
 * @param {Error} err An error produced by the Redis client
 */
function handleRedisError(err) {
  console.warn('Error in Redis %s', err);
}

function getEventEmitter() {
  debug('getEventEmitter');
  return eventEmitter;
}

function setEventEmitter(emitter) {
  debug('setEventEmitter');
  eventEmitter = emitter;
}

/** @type {Array} Functions that are allowed to be invoked */
var invokeFunctions = ['sync', 'syncRecords', 'listCollisions', 'removeCollision'];

/** Invoke the Sync Server. */
function invoke(dataset_id, params, callback) {
  debug('invoke');

  if (arguments.length < 3) throw new Error('invoke requires 3 arguments');

  // Verify that fn param has been passed
  if (!params || !params.fn) {
    var err = new Error('no fn parameter provided in params "' + util.inspect(params) + '"');
    debugError('[%s] warn %s %j', dataset_id, err, params);
    return callback(err, null);
  }

  var fn = params.fn;

  // Verify that fn param is valid
  if (invokeFunctions.indexOf(fn) < 0) {
    return callback(new Error('invalid fn parameter provided in params "' + fn + '"'), null);
  }

  // We can only continue if sync has connected to its dependencies i.e. mongo & redis
  if (!syncConnected) {
    return callback(new Error('Sync not connected'));
  }

  var fnHandler =  module.exports[fn] || server[fn] || server.api[fn];

  server.api.start(function() {
    return fnHandler(dataset_id, params, callback);
  });
}

// extend from empty object to force copy, and because last source overrides the previous ones
module.exports = _.extend({}, server, {
  sync: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.sync),
  syncRecords: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.syncRecords),
  listCollisions: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.api.listCollisions),
  removeCollision: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, server.api.removeCollision),
  api: _.extend({}, server.api, {
    connect: connect,
    invoke: invoke,
    toJSON: toJSON,
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
