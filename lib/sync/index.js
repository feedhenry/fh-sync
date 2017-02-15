var syncUtil = require('./util');

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

function doListCollisions(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'doListCollisions');

  // TODO

  return cb(null, {});
}

function doRemoveCollision(dataset_id, params, cb) {
  syncUtil.doLog(dataset_id, 'info', 'doRemoveCollision');

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

function doClientSync(dataset_id, params, callback) {
  syncUtil.doLog(dataset_id, 'info', 'doClientSync');

  // TODO

  return cb(null, {});
}

/* Synchronise the individual records for a dataset */
function doSyncRecords(dataset_id, params, callback) {
  syncUtil.doLog(dataset_id, 'info', 'doSyncRecords');

  // TODO

  return cb(null, {});
}

function start(mongoClient, cb) {
  // if we have a mongo client, use it

  // if we don't have a mongClient, work out the connection string by calling fh.db({act:connectionString}) ?
  // and create a mongo client

  // create the ack queue

  // create the pending queue

  // create the sync queue

  // start the ack worker

  // start the pending worker

  // start the sync worker

  // start the sync scheduler
}

// Functions which can be invoked through sync.invoke
var invokeFunctions = {
  "sync": doClientSync,
  "syncRecords": doSyncRecords,
  "listCollisions": doListCollisions,
  "removeCollision": doRemoveCollision,
  "setLogLevel": setLogLevel
};

module.exports = {
  init: init,
  invoke: invoke,
  stop: stop,
  stopAll: stopAll,
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
};




