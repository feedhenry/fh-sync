var syncUtil = require('./util');
var async = require('async');
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var redis = require('redis');
var metricsModule = require('./sync-metrics');
var MongodbQueue = require('./mongodbQueue');
var Worker = require('./worker');
var dataHandlersModule = require('./dataHandlers');
var storageModule = require('./storage');
var hashProviderModule = require('./hashProvider');
var ackProcessor = require('./ack-processor');
var pendingProcessor = require('./pending-processor');
var syncProcessor = require('./sync-processor');
var syncSchedulerModule = require('./sync-scheduler');
var syncLockModule = require('./lock');

var ackQueue, pendingQueue, syncQueue, ackWorker, pendingWorker, syncWorker;

//TODO: remove redisClient. We probably don't need it anymore
var redisClient = null;
var mongoDbClient = null;
var metricsClient = null;
var dataHandlers = null;
var syncStorage = null;
var hashProvider = null;
var syncLock = null;

var syncStarted = false;

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


/**
 * Connect to mongodb & redis with the given connection urls.
 * This should be called before `start()` is called
 * 
 * @param {string} mongoDBConnectionUrl A MongoDB connection uril in a format supported by the `mongodb` module
 * @param {string} redisUrl A redis connection url in a format supported by the `redis` module
 * @param {Object} metricsConf Metrics configuration
 * @param {function} cb 
 */
function connect(mongoDBConnectionUrl, redisUrl, metricsConf, cb) {
  if (arguments.length < 4) throw new Error('connect requires 4 arguments');

  async.series([
    function connectToMongoDB(callback) {
      MongoClient.connect(mongoDBConnectionUrl, callback);
    },
    function connectToRedis(callback) {
      var redisOpts = {
        url: redisUrl
      };
      var client = redis.createClient(redisOpts);
      return callback(null, client);
    }
  ], function(err, results) {
    if (err) return cb(err);
    mongoDbClient = results[0];
    redisClient = results[1];
    metricsClient = metricsModule.init(metricsConf);
    return cb(null, mongoDbClient, redisClient, metricsClient);
  });
}

/**
 * Starts all sync queues, workers & the sync scheduler.
 * This should only be called after `connect()`.
 * If this is not explicitly called before clients send sync requests,
 * it will be called when a client sends a sync request.
 * It is OK for this to be called multiple times.
 * 
 * @param {function} cb
 */
function start(cb) {
  if (arguments.length < 1) throw new Error('start requires 1 argument');

  if (syncStarted) return cb();

  if (mongoDbClient === null || redisClient === null) {
    return cb('MongoDB Client & Redis Client are not connected. Ensure connect() is called before calling start');
  }

  dataHandlers = dataHandlersModule();
  syncStorage = storageModule();
  hashProvider = hashProviderModule();
  syncLock = syncLockModule();

  async.waterfall([
    function createQueues(callback) {
      ackQueue = new MongodbQueue('sync-ack-queue', metricsClient, {mongodb: mongoDbClient});
      pendingQueue = new MongodbQueue('sync-pending-queue', metricsClient, {mongodb: mongoDbClient});
      syncQueue = new MongodbQueue('sync-queue', metricsClient, {mongodb: mongoDbClient});

      async.parallel([
        async.apply(ackQueue.create),
        async.apply(pendingQueue.create),
        async.apply(syncQueue.create)
      ], callback);
    },
    function createWorkers(callback) {
      var syncProcessorImpl = syncProcessor(syncStorage, dataHandlers, metricsClient, hashProvider);
      syncWorker = new Worker(syncQueue, syncProcessorImpl, metricsClient, {name: 'sync_worker'});

      var ackProcessorImpl = ackProcessor(syncStorage);
      ackWorker = new Worker(ackQueue, ackProcessorImpl, metricsClient, {name: 'ack_worker'});

      var pendingProcessorImpl = pendingProcessor(syncStorage, dataHandlers, hashProvider, metricsClient);
      pendingWorker = new Worker(pendingQueue, pendingProcessorImpl, metricsClient, {name: 'pending_worker'});

      ackWorker.work();
      pendingWorker.work();
      syncWorker.work();
      return callback();
    },
    function startSyncScheduler(callback) {
      var SyncScheduler = syncSchedulerModule(syncLock, syncStorage, metricsClient).SyncScheduler;
      syncScheduler = new SyncScheduler(syncQueue);
      return callback();
    }
  ], function(err) {
    if (err) return cb(err);
    syncStarted = true;
    return cb();
  });
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