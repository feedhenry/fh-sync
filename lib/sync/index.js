var syncUtil = require('./util');
var async = require('async');
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var MongodbQueue = require('./mongodbQueue');
var AckWorker = require('./ack-worker');
var PendingWorker = require('./pending-worker');
var SyncWorker = require('./sync-worker');
var SyncScheduler = require('./sync-scheduler');

var ackQueue, pendingQueue, syncQueue, ackWorker, pendingWorker, syncWorker;

var redisClient, mongoDbClient;

function toJSON(dataset_id, returnData, cb) {
  syncUtil.doLog(dataset_id, 'info', 'toJSON');

  // TODO

  return cb(null, {});
}

// Functions that are allowed to be invoked
var invokeFunctions = ['sync', 'syncRecords', 'listCollisions', 'removeCollision', 'setLogLevel'];

// Invoke the Sync Server.
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
  var fnHandler = module.exports[fn];

  return fnHandler(dataset_id, params, callback);
}

// Initialise cloud data sync service for specified dataset.
function init(dataset_id, options, cb) {
  syncUtil.doLog(dataset_id, 'info', 'init');
  
  // TODO

  cb(null, {});
}

// Stop cloud data sync for the specified dataset_id.
function stop(dataset_id, cb) {
  syncUtil.doLog(dataset_id, 'info', 'stop');
  
  // TODO

  cb(null, {});
}

// Stop cloud data sync service for ALL datasets.
function stopAll(cb) {
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'info', 'stopAll');
  
  // TODO

  cb(null, {});
}

function listCollisions(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'listCollisions');

  // TODO

  return cb(null, {});
}

// Defines a handler function for deleting a collision from the collisions list.
// Should be called after the dataset is initialised.
function removeCollision(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'removeCollision');

  // TODO

  return cb(null, {});
}

function setLogLevel(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'setLogLevel');
  if (params && params.logLevel) {
    syncUtil.doLog(dataset_id, 'info', 'Setting logLevel to "' + params.logLevel + '"');
    syncUtil.setLogger(dataset_id, params);
    cb(null, {"status": "ok"});
  }
  else {
    cb('logLevel parameter required');
  }
}

function sync(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'sync');

  // TODO

  return cb(null, {});
}

// Synchronise the individual records for a dataset
function syncRecords(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'syncRecords');

  // TODO

  return cb(null, {});
}

function connect(mongoDBConnectionUrl, redisUrl, cb) {
  async.parallel([
    function connectToMongoDB(callback) {
      MongoClient.connect(mongoDBConnectionUrl, callback);
    },
    function connectToRedis(callback) {
      var client = redis.createClient(redisUrl);
      return callback(null, client);
    }
  ], function(err, results) {
    if (err) return cb(err);
    mongoDbClient = results[0];
    redisClient = results[1];
    return cb();
  });
}

function start(cb) {
  async.waterfall([
    function createQueues(callback) {
      ackQueue = new MongodbQueue('sync-ack-queue', {mongodb: mongoDbClient});
      pendingQueue = new MongodbQueue('sync-pending-queue', {mongodb: mongoDbClient});
      syncQueue = new MongodbQueue('sync-queue', {mongodb: mongoDbClient});

      async.parallel([
        async.apply(ackQueue.create),
        async.apply(pendingQueue.create),
        async.apply(syncQueue.create)
      ], callback);
    },
    function createWorkers(callback) {
      ackWorker = new AckWorker(ackQueue);
      pendingWorker = new PendingWorker(pendingQueue);
      syncWorker = new SyncWorker(syncQueue);
      return callback();
    },
    function startSyncScheduler(callback) {
      syncScheduler = new SyncScheduler(redisClient);
      return callback();
    }
  ], cb);
}

module.exports = {
  sync: sync,
  syncRecords: syncRecords,
  listCollisions: listCollisions,
  removeCollision: removeCollision,
  api: {
    init: init,
    invoke: invoke,
    stop: stop,
    stopAll: stopAll,
    connect: connect,
    start: start,
    toJSON: toJSON,
    setLogLevel: setLogLevel,
    globalHandleList: function() {},
    globalHandleCreate: function() {},
    globalHandleRead: function() {},
    globalHandleUpdate: function() {},
    globalHandleDelete: function() {},
    globalHandleCollision: function() {},
    globalListCollisions: function() {},
    globalRemoveCollision: function() {},
    globalInterceptRequest: function() {},
    globalInterceptResponse: function() {},
    handleList: function() {},
    handleCreate: function() {},
    handleRead: function() {},
    handleUpdate: function() {},
    handleDelete: function() {},
    handleCollision: function() {},
    listCollisions: function() {},
    removeCollision: function() {},
    interceptRequest: function() {},
    interceptResponse: function() {}
  }
};