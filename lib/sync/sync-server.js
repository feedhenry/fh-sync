var ackProcessor = require('./ack-processor');
var async = require('async');
var dataHandlersModule = require('./dataHandlers');
var datasets = require('./datasets');
var defaultDataHandlersModule = require('./default-dataHandlers');
var hashProviderModule = require('./hashProvider');
var interceptorsModule = require('./interceptors');
var MongodbQueue = require('./mongodbQueue');
var pendingProcessor = require('./pending-processor');
var storageModule = require('./storage');
var syncApiModule = require('./api-sync');
var syncLockModule = require('./lock');
var syncProcessor = require('./sync-processor');
var syncRecordsApiModule = require('./api-syncRecords');
var syncSchedulerModule = require('./sync-scheduler');
var syncUtil = require('./util');
var util = require('util');
var Worker = require('./worker');
var _ = require('underscore');

//TODO: remove redisClient. We probably don't need it anymore
var redisClient = null;
var mongoDbClient = null;
var metricsClient = null;
var hashProvider = null;
var syncLock = null;
var syncScheduler = null;
var syncStorage = null;
var interceptors = null;
var apiSync = null;
var apiSyncRecords = null;
var dataHandlers = null;

var ackQueue;
var pendingQueue;
var syncQueue;
var ackWorker;
var pendingWorker;
var syncWorker;

//default global configuration options for the sync server
var DEFAULT_SYNC_CONF = {
  //how often workers should check for the next job. Default: 1s
  workerInterval: 1000,
  //how often the scheduler should check the datasetClients. Default: 500ms
  schedulerInterval: 500,
  //the max time a scheduler can hold the lock for. Default: 20s
  schedulerLockMaxTime: 20000,
  //the default lock name for the sync scheduler
  schedulerLockName: 'locks:sync:SyncScheduler'
};
var syncConfig = _.extend({}, DEFAULT_SYNC_CONF);
var syncStarted = false;

// Initialise cloud data sync service for specified dataset.
function init(dataset_id, options, cb) {
  syncUtil.doLog(dataset_id, 'info', 'init sync for dataset ' + dataset_id + ' with options ' + util.inspect(options));
  datasets.init(dataset_id, options);
  start(function(err) {
    if (err) {
      return cb(err);
    }
    syncStorage.updateManyDatasetClients({datasetId: dataset_id}, {stopped: false}, cb);
  });
}

function setClients(mongo, redis, metrics) {
  mongoDbClient = mongo;
  redisClient = redis;
  metricsClient = metrics;
  dataHandlers = dataHandlersModule({
    defaultHandlers: defaultDataHandlersModule(mongoDbClient)
  });
  syncStorage = storageModule(mongoDbClient);
  // TODO: follow same pattern as other modules for this hashProviderModule
  hashProvider = hashProviderModule;
  syncLock = syncLockModule(mongoDbClient, 'fhsync_locks');
  interceptors = interceptorsModule();
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

  async.series([
    function createQueues(callback) {
      ackQueue = new MongodbQueue('fhsync_ack_queue', metricsClient, {mongodb: mongoDbClient});
      pendingQueue = new MongodbQueue('fhsync_pending_queue', metricsClient, {mongodb: mongoDbClient});
      syncQueue = new MongodbQueue('fhsync_queue', metricsClient, {mongodb: mongoDbClient});

      async.parallel([
        async.apply(ackQueue.create.bind(ackQueue)),
        async.apply(ackQueue.startPruneJob.bind(ackQueue), true),
        async.apply(pendingQueue.create.bind(pendingQueue)),
        async.apply(pendingQueue.startPruneJob.bind(ackQueue), true),
        async.apply(syncQueue.create.bind(syncQueue)),
        async.apply(syncQueue.startPruneJob.bind(ackQueue), true),
      ], callback);
    },
    function initApis(callback) {
      apiSync = syncApiModule(interceptors, ackQueue, pendingQueue, syncStorage);
      apiSyncRecords = syncRecordsApiModule(syncStorage, pendingQueue);
      return callback();
    },
    function createWorkers(callback) {
      var syncProcessorImpl = syncProcessor(syncStorage, dataHandlers, metricsClient, hashProvider);
      syncWorker = new Worker(syncQueue, syncProcessorImpl, metricsClient, {name: 'sync_worker', interval: syncConfig.workerInterval});

      var ackProcessorImpl = ackProcessor(syncStorage);
      ackWorker = new Worker(ackQueue, ackProcessorImpl, metricsClient, {name: 'ack_worker', interval: syncConfig.workerInterval});

      var pendingProcessorImpl = pendingProcessor(syncStorage, dataHandlers, hashProvider, metricsClient);
      pendingWorker = new Worker(pendingQueue, pendingProcessorImpl, metricsClient, {name: 'pending_worker', interval: syncConfig.workerInterval});

      ackWorker.work();
      pendingWorker.work();
      syncWorker.work();
      return callback();
    },
    function startSyncScheduler(callback) {
      var SyncScheduler = syncSchedulerModule(syncLock, syncStorage, metricsClient).SyncScheduler;
      syncScheduler = new SyncScheduler(syncQueue, {timeBetweenChecks: syncConfig.schedulerInterval, timeBeforeCrashAssumed: syncConfig.schedulerLockMaxTime, syncSchedulerLockName: syncConfig.schedulerLockName});
      syncScheduler.start();
      return callback();
    }
  ], function(err) {
    if (err) return cb(err);
    syncStarted = true;
    return cb();
  });
}

function sync(datasetId, params, cb) {
  apiSync(datasetId, params, cb);
}

function syncRecords(datasetId, params, cb) {
  apiSyncRecords(datasetId, params, cb);
}

// Stop cloud data sync for the specified dataset_id.
function stop(dataset_id, cb) {
  if (!syncStarted) {
    return cb();
  }
  syncUtil.doLog(dataset_id, 'info', 'stop sync for dataset');
  syncStorage.updateManyDatasetClients({datasetId: dataset_id}, {stopped: true}, cb);
}

function setConfig(conf) {
  syncConfig = _.extend({}, DEFAULT_SYNC_CONF, conf);
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
  ackQueue.stopPruneJob();
  pendingQueue.stopPruneJob();
  syncQueue.stopPruneJob();
  async.parallel([
    async.apply(syncStorage.updateManyDatasetClients, {}, {stopped: true}),
    async.apply(syncWorker.stop.bind(syncWorker)),
    async.apply(ackWorker.stop.bind(ackWorker)),
    async.apply(pendingWorker.stop.bind(pendingWorker)),
    async.apply(syncScheduler.stop.bind(syncScheduler))
  ], function(err) {
    if (err) {
      syncUtil.doLog(syncUtil.SYNC_LOGGER, 'error', 'Failed to stop sync due to error : ' + util.inspect(err));
      return cb(err);
    }
    setConfig();
    dataHandlers.restore();
    interceptors.restore();
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
    dataHandlers = null;
    interceptors = null;
    hashProvider = null;
    syncLock = null;
    return cb();
  });
}

function globalInterceptRequest(fn) {
  interceptors.setDefaultRequestInterceptor(fn);
}
function globalInterceptResponse(fn) {
  interceptors.setDefaultResponseInterceptor(fn);
}
function interceptRequest(datasetId, fn) {
  interceptors.setRequestInterceptor(datasetId, fn);
}
function interceptResponse(datasetId, fn) {
  interceptors.setResponseInterceptor(datasetId, fn);
}

function listCollisions(datasetId, params, cb) {
  dataHandlers.listCollisions(datasetId, params, cb);
}

function removeCollision(datasetId, params, cb) {
  dataHandlers.removeCollision(datasetId, params, cb);
}

function callHandler(handlerName, args) {
  dataHandlers[handlerName].apply(null, args);
}

module.exports = {
  sync: sync,
  syncRecords: syncRecords,
  setClients: setClients,
  api: {
    init: init,
    start: start,
    stop: stop,
    stopAll: stopAll,
    setConfig: setConfig,
    globalInterceptRequest: globalInterceptRequest,
    globalInterceptResponse: globalInterceptResponse,
    interceptRequest: interceptRequest,
    interceptResponse: interceptResponse,
    listCollisions: listCollisions,
    removeCollision: removeCollision,
    callHandler: callHandler
  }
};