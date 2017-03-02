var syncUtil = require('./util');
var async = require('async');
var util = require('util');
var MongoClient = require('mongodb').MongoClient;
var redis = require('redis');
var metricsModule = require('./sync-metrics');
var MongodbQueue = require('./mongodbQueue');
var Worker = require('./worker');
var dataHandlersModule = require('./dataHandlers');
var defaultDataHandlersModule = require('./default-dataHandlers');
var storageModule = require('./storage');
var hashProviderModule = require('./hashProvider');
var ackProcessor = require('./ack-processor');
var pendingProcessor = require('./pending-processor');
var syncProcessor = require('./sync-processor');
var syncSchedulerModule = require('./sync-scheduler');
var syncLockModule = require('./lock');
var interceptorsModule = require('./interceptors');
var syncApiModule = require('./api-sync');
var syncRecordsApiModule = require('./api-syncRecords');
var datasets = require('./datasets');

var ackQueue, pendingQueue, syncQueue, ackWorker, pendingWorker, syncWorker;

//TODO: remove redisClient. We probably don't need it anymore
var redisClient = null;
var mongoDbClient = null;
var metricsClient = null;
var dataHandlers = null;
var syncStorage = null;
var hashProvider = null;
var syncLock = null;
var interceptors = null;
var apiSync = null;
var apiSyncRecords = null;

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

  start(function(err) {
    if (err) {
      return callback(err);
    }
    return fnHandler(dataset_id, params, callback);
  });
}

// Initialise cloud data sync service for specified dataset.
function init(dataset_id, options, cb) {
  syncUtil.doLog(dataset_id, 'info', 'init sync for dataset');
  start(function(err){
    if (err) {
      return cb(err);
    }
    datasets.init(dataset_id, options);
    syncStorage.updateManyDatasetClients({datasetId: dataset_id}, {stopped: false}, cb);
  });
}

// Stop cloud data sync for the specified dataset_id.
function stop(dataset_id, cb) {
  if (!syncStarted) {
    return cb();
  }
  syncUtil.doLog(dataset_id, 'info', 'stop sync for dataset');
  syncStorage.updateManyDatasetClients({datasetId: dataset_id}, {stopped: true}, cb);
}

// Stop cloud data sync service for ALL datasets and reset.
// This should really only used by tests.
function stopAll(cb) {
  //sync is not started yet, but connect could be called already. In this case, just reset a few things
  if (!syncStarted) {
    mongoDbClient = null;
    redisClient = null;
    metricsClient = null;
    return cb();
  }
  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'info', 'stopAll syncs');
  async.parallel([
    async.apply(syncStorage.updateManyDatasetClients, {}, {stopped: true}),
    async.apply(syncWorker.stop.bind(syncWorker)),
    async.apply(ackWorker.stop.bind(ackWorker)),
    async.apply(pendingWorker.stop.bind(pendingWorker)),
    async.apply(syncScheduler.stop.bind(syncScheduler))
  ], function(err){
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to stop sync due to error : ' + util.inspect(err));
      return cb(err);
    }
    mongoDbClient = null;
    redisClient = null;
    metricsClient = null;
    ackQueue = null;
    pendingQueue = null;
    syncQueue = null;
    ackWorker = null;
    pendingWorker = null;
    syncWorker = null;
    syncStarted = false;
    return cb();
  });
}

function listCollisions(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'listCollisions');
  return dataHandlers.listCollisions(dataset_id, params.meta_data, cb);
}

// Defines a handler function for deleting a collision from the collisions list.
// Should be called after the dataset is initialised.
function removeCollision(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'removeCollision');
  return dataHandlers.removeCollision(dataset_id, params.hash, params.meta_data, cb);
}

function setLogLevel(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'setLogLevel');
  if (params && params.logLevel) {
    syncUtil.doLog(dataset_id, 'info', 'Setting logLevel to "' + params.logLevel + '"');
    syncUtil.setLogger(dataset_id, params);
    cb && cb(null, {"status": "ok"});
  }
  else {
    cb && cb('logLevel parameter required');
  }
}

function sync(datasetId, params, cb) {
  apiSync(datasetId, params, cb);
}

// Synchronise the individual records for a dataset
function syncRecords(datasetId, params, cb) {
  apiSyncRecords(datasetId, params, cb);
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

  dataHandlers = dataHandlersModule(options = {
    defaultHandlers: defaultDataHandlersModule(mongoDbClient)
  });
  syncStorage = storageModule(mongoDbClient);
  // TODO: follow same pattern as other modules for this hashProviderModule
  hashProvider = hashProviderModule;
  syncLock = syncLockModule(mongoDbClient, 'fhsync_locks');
  interceptors = interceptorsModule();

  async.series([
    function createQueues(callback) {
      ackQueue = new MongodbQueue('fhsync_ack_queue', metricsClient, {mongodb: mongoDbClient});
      pendingQueue = new MongodbQueue('fhsync_pending_queue', metricsClient, {mongodb: mongoDbClient});
      syncQueue = new MongodbQueue('fhsync_queue', metricsClient, {mongodb: mongoDbClient});

      async.parallel([
        async.apply(ackQueue.create.bind(ackQueue)),
        async.apply(pendingQueue.create.bind(pendingQueue)),
        async.apply(syncQueue.create.bind(syncQueue))
      ], callback);
    },
    function initApis(callback) {
      apiSync = syncApiModule(interceptors, ackQueue, pendingQueue, syncStorage);
      apiSyncRecords = syncRecordsApiModule(syncStorage, pendingQueue);
      return callback();
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
      syncScheduler.start();
      return callback();
    }
  ], function(err) {
    if (err) return cb(err);
    syncStarted = true;
    return cb();
  });
}

module.exports = {
  sync: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, sync),
  syncRecords: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, syncRecords),
  listCollisions: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, listCollisions),
  removeCollision: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, removeCollision),
  api: {
    init: init,
    invoke: metricsModule.timeAsyncFunc(metricsModule.KEYS.SYNC_API_PROCESS_TIME, invoke),
    stop: stop,
    stopAll: stopAll,
    connect: connect,
    start: start, //TODO: looks like we don't need to expose this one anymore? init can be used as start
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
    handleList: function() {},
    handleCreate: function() {},
    handleRead: function() {},
    handleUpdate: function() {},
    handleDelete: function() {},
    handleCollision: function() {},
    listCollisions: function() {},
    removeCollision: function() {},
    globalInterceptRequest: function(fn) {
      interceptors.setDefaultRequestInterceptor(fn);
    },
    globalInterceptResponse: function(fn) {
      interceptors.setDefaultResponseInterceptor(fn);
    },
    interceptRequest: function(datasetId, fn) {
      interceptors.setRequestInterceptor(datasetId, fn);
    },
    interceptResponse: function(datasetId, fn) {
      interceptors.setResponseInterceptor(datasetId, fn);
    }
  }
};
