var syncUtil = require('./util');
var async = require('async');
var MongoClient = require('mongodb').MongoClient;
var MongodbQueue = require('./mongodbQueue');
var AckWorker = require('./ack-worker');
var PendingWorker = require('./pending-worker');
var SyncWorker = require('./sync-worker');
var SyncScheduler = require('./sync-scheduler');

var ackQueue, pendingQueue, syncQueue, ackWorker, pendingWorker, syncWorker;

function toJSON(dataset_id, returnData, cb) {
  syncUtil.doLog(dataset_id, 'info', 'toJSON');

  // TODO

  return cb(null, {});
}

function invoke(dataset_id, params, callback) {
  syncUtil.doLog(dataset_id, 'info', 'invoke');

  // Verify that fn param has been passed
  if (!params || !params.fn) {
    syncUtil.doLog(dataset_id, 'warn', 'no fn parameter provided :: ' + util.inspect(params), params);
    return callback("no_fn", null);
  }

  var fn = params.fn;

  // Verify that fn param is valid
  var fnHandler = invokeFunctions[fn];
  if (!fnHandler) {
    return callback("unknown_fn : " + fn, null);
  }

  return fnHandler(dataset_id, params, callback);
}

function init(dataset_id, options, cb) {
  syncUtil.doLog(dataset_id, 'info', 'init');
  
  // TODO

  cb(null, {});
}

function stop(dataset_id, cb) {
  syncUtil.doLog(dataset_id, 'info', 'stop');
  
  // TODO

  cb(null, {});
}

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

function sync(dataset_id, params, callback) {
  syncUtil.doLog(dataset_id, 'info', 'sync');

  // TODO

  return cb(null, {});
}

/* Synchronise the individual records for a dataset */
function syncRecords(dataset_id, params, callback) {
  syncUtil.doLog(dataset_id, 'info', 'syncRecords');

  // TODO

  return cb(null, {});
}

function start(cb) {
  async.waterfall([
    function getMongoDBConnectionString(callback) {
      // if we can't get a connection string, it probably means we don't have an upgraded database.
      // In that case, the callback will have an error
      $fh.db({
        "act" : "connectionString"
      }, callback);
    },
    function connectToMongoDB(connectionString, callback) {
      MongoClient.connect(url, callback);
    },
    function createQueues(mongoDbClient, callback) {
      ackQueue = new MongodbQueue('sync-ack-queue', {mongodb: MongoClient});
      pendingQueue = new MongodbQueue('sync-pending-queue', {mongodb: MongoClient});
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
      syncScheduler = new SyncScheduler();
    }
  ], cb);
}

// Functions which can be invoked through sync.invoke
var invokeFunctions = {
  "sync": sync,
  "syncRecords": syncRecords,
  "listCollisions": listCollisions,
  "removeCollision": removeCollision,
  "setLogLevel": setLogLevel
};

module.exports = {
  init: init,
  invoke: invoke,
  stop: stop,
  stopAll: stopAll,
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
};




