var async = require('async');
var util = require('util');
var DataSetModel = require('./sync-DataSetModel');
var syncUtil = require('./sync-util');
var config;
var db = require('./db');
var fhdb;

module.exports = function (cfg) {
  if (!cfg) {
    return;
  }
  config = cfg;
  return sync();
};

var syncInited = false;

var sync = function () {

  /**
   * Generic setter that can be used to override a default sync handler.
   * Ensures passed in handler is a function and throws an AssertionError if not
   *
   * @param  {String} target The handler to override
   * @return {Function}
   */
  function generateSetHandlerFn (target) {
    return function _doSetHandler (dataset_id, fn) {
      syncUtil.ensureHandlerIsFunction(target, fn);

      DataSetModel.getDataset(dataset_id, function (err, dataset) {
        if (!err) {
          dataset[target] = fn;
        }
      });
    };
  }


  /**
   * Each handler override that is supported needs a setter function, this
   * generates them so they can be attached to the sync instance.
   *
   * For example this will bind and $fh.sync.handleList function, which allows
   * one to set a custom "listHandler"
   *
   * @return {Object}
   */
  function bindHandlerSetters (instance) {
    var handlerMap = {
      handleHash: 'hashHandler',
      handleList: 'listHandler',
      handleCreate: 'createHandler',
      handleRead: 'readHandler',
      handleUpdate: 'updateHandler',
      handleDelete: 'deleteHandler',
      handleCollision: 'collisionHandler',
      listCollisions: 'collisionLister',
      removeCollision: 'collisionRemover',
      interceptRequest: 'requestInterceptor',
      interceptResponse: 'responseInterceptor'
    };

    Object.keys(handlerMap).forEach(function (key) {
      instance[key] = generateSetHandlerFn(handlerMap[key]);
    });
  }

  var globalInit = function () {
    if (!syncInited) {
      syncInited = true;
      fhdb = db(config);
      DataSetModel.setFHDB(fhdb);
      DataSetModel.init();
    }
  }

  globalInit();

  var instance = {
    init: DataSetModel.createDataset.bind(null),
    invoke: doInvoke.bind(null),
    stop: DataSetModel.stopDatasetSync.bind(null),
    stopAll: DataSetModel.stopAllDatasetSync.bind(null),
    toJSON: DataSetModel.toJSON.bind(null),
    setLogLevel: doSetLogLevel,
    globalHandleList: DataSetModel.setGlobalListHandler.bind(null),
    globalHandleCreate: DataSetModel.setGlobalCreateHandler.bind(null),
    globalHandleRead: DataSetModel.setGlobalReadHandler.bind(null),
    globalHandleUpdate: DataSetModel.setGlobalUpdateHandler.bind(null),
    globalHandleDelete: DataSetModel.setGlobalDeleteHandler.bind(null),
    globalHandleCollision: DataSetModel.setGlobalCollisionHandler.bind(null),
    globalListCollisions: DataSetModel.setGlobalCollisionLister.bind(null),
    globalRemoveCollision: DataSetModel.setGlobalCollisionRemover.bind(null),
    globalInterceptRequest: DataSetModel.setGlobalRequestInterceptor.bind(null),
    globalInterceptResponse: DataSetModel.setGlobalResponseInterceptor.bind(null),
    globalHandleHash: DataSetModel.setGlobalHashHandler.bind(null)
  };

  // Make sure to bind custom handler setters
  bindHandlerSetters(instance);

  return instance;
}

/* ======================================================= */
/* ================== PRIVATE FUNCTIONS ================== */
/* ======================================================= */

/* jshint ignore:start */
function toJSON(dataset_id, returnData, cb) {
  DataSetModel.toJSON(dataset_id, returnData, cb);
}
/* jshint ignore:end */
function doInvoke(dataset_id, params, callback) {

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

function doListCollisions(dataset_id, params, cb) {
  DataSetModel.doCollisionLister(dataset_id, cb, params.meta_data);
}

function doRemoveCollision(dataset_id, params, cb) {
  DataSetModel.doCollisionRemover(dataset_id, params.hash, cb, params.meta_data);
}

function doSetLogLevel(dataset_id, params, cb) {
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

  var dataset;

  function clientSyncImpl() {

    DataSetModel.getDatasetClient(dataset_id, params, function (err, datasetClient) {
      if (err) return callback(err);

      //Deal with any Acknowledgement of updates from the client
      acknowledgeUpdates(dataset_id, params, function () {
        if (params.pending && params.pending.length > 0) {
          syncUtil.doLog(dataset_id, 'info', 'Found ' + params.pending.length + ' pending records. processing', params);

          // Process Pending Params then re-sync data
          processPending(dataset_id, dataset, params, function () {
            syncUtil.doLog(dataset_id, 'verbose', 'back from processPending', params);
            // Changes have been submitted from client, redo the list operation on back end system.
            DataSetModel.syncDatasetClient(datasetClient, function (err, res) {
              if (err) return callback(err);
              var resOut = {"hash": res.hash};
              return returnUpdates(dataset_id, params, resOut, callback);
            });
          });
        }
        else {
          if (datasetClient.dataHash) {
            // No pending updates, just sync client dataset
            //syncUtil.doLog(dataset_id, 'verbose', 'doClientSync - No pending - Hash (Client :: Cloud) = ' + params.dataset_hash + ' :: ' + datasetClient.dataHash, params);
            var res;
            if (datasetClient.dataHash === params.dataset_hash) {
              syncUtil.doLog(dataset_id, 'verbose', 'doClientSync - No pending - Hashes match. Just return hash', params);
              res = {"hash": datasetClient.hash};
              return returnUpdates(dataset_id, params, res, callback);
            }
            else {
              syncUtil.doLog(dataset_id, 'info', 'doClientSync - No pending - Hashes NO NOT match (Client :: Cloud) = ' + params.dataset_hash + ' :: ' + datasetClient.dataHash + ' - return cloud hash to trigger partial dataset', params);
              res = {hash: datasetClient.dataHash};
              return returnUpdates(dataset_id, params, res, callback);
            }
          } else {
            syncUtil.doLog(dataset_id, 'info', 'No pending records. No cloud data set - invoking list on back end system', params);
            DataSetModel.syncDatasetClient(datasetClient, function (err, res) {
              if (err) return callback(err);
              return returnUpdates(dataset_id, params, res, callback);
            });
          }
        }
      });
    });
  }

  DataSetModel.getDataset(dataset_id, function (err, res) {
    if (err) {
      return callback(err, null);
    }

    var interceptorParams = {
      "query_params": params.query_params,
      "meta_data": params.meta_data
    }

    DataSetModel.doRequestInterceptor(dataset_id, interceptorParams, function (err) {
      if (err) {
        return callback(err, null);
      }
      else {
        dataset = res;
        clientSyncImpl();
      }
    });
  });
}

function processPending(dataset_id, dataset, params, cb) {
  var pending = params.pending;
  var meta_data = params.meta_data;

  var cuid = syncUtil.getCuid(params);

  syncUtil.doLog(dataset_id, 'verbose', 'processPending :: starting async.forEachSeries');

  async.waterfall([
    function getHashFunctionForPending (next) {
      DataSetModel.getHashFunction(dataset_id, next);
    },
    function (hashingFunction, next) {
      async.forEachSeries(pending, function (pendingObj, itemCallback) {
          //var pendingObj = pending[i];
          syncUtil.doLog(dataset_id, 'silly', 'processPending :: item = ' + util.inspect(pendingObj), params);
          var action = pendingObj.action;
          var uid = pendingObj.uid;
          var pre = pendingObj.pre;
          var post = pendingObj.post;
          var hash = pendingObj.hash;
          var timestamp = pendingObj.timestamp;

          function addUpdate(type, action, hash, uid, msg, cb) {

            var update = {
              cuid: cuid,
              type: type,
              action: action,
              hash: hash,
              uid: uid,
              msg: util.inspect(msg)
            };

            fhdb({
              "act": "list",
              "type": dataset_id + "-updates",
              "eq": {
                "cuid": cuid,
                "type": type,
                "action": action,
                "hash": hash,
                "uid": uid
              }
            }, function (err, found) {
              if (err) return cb(err);
              if (found && found.list && found.list.length > 0) {
                syncUtil.doLog(dataset_id, 'info', 'Update is already recorded, ignore', update);
                return cb(null, found.list[0]);
              } else {
                fhdb({
                  "act": "create",
                  "type": dataset_id + "-updates",
                  "fields": update
                }, function (err, res) {
                  cb(err, res);
                });
              }
            });
          }

          if ("create" === action) {
            syncUtil.doLog(dataset_id, 'verbose', 'CREATE Start', params);
            DataSetModel.doCreateHandler(dataset_id, post, function (err, data) {
              if (err) {
                syncUtil.doLog(dataset_id, 'warn', 'CREATE Failed - uid=' + uid + ' : err = ' + err, params);
                return addUpdate("failed", "create", hash, uid, err, itemCallback);
              }
              syncUtil.doLog(dataset_id, 'info', 'CREATE Success - uid=' + data.uid + ' : hash = ' + hash, params);
              return addUpdate("applied", "create", hash, data.uid, '', itemCallback);
            }, meta_data);
          }
          else if ("update" === action) {
            syncUtil.doLog(dataset_id, 'verbose', 'UPDATE Start', params);
            DataSetModel.doReadHandler(dataset_id, uid, function (err, data) {
              if (err) {
                syncUtil.doLog(dataset_id, 'warn', 'READ for UPDATE Failed - uid=' + uid + ' : err = ' + err, params);
                return addUpdate("failed", "update", hash, uid, err, itemCallback);
              }
              syncUtil.doLog(dataset_id, 'verbose', ' READ for UPDATE Success', params);
              syncUtil.doLog(dataset_id, 'silly', 'READ for UPDATE Data : \n' + util.inspect(data), params);

              var preHash = hashingFunction(pre, uid);
              var dataHash = hashingFunction(data, uid);

              syncUtil.doLog(dataset_id, 'verbose', 'UPDATE Hash Check ' + uid + ' (client :: dataStore) = ' + preHash + ' :: ' + dataHash, params);

              if (preHash === dataHash) {
                DataSetModel.doUpdateHandler(dataset_id, uid, post, function (err) {
                  if (err) {
                    syncUtil.doLog(dataset_id, 'warn', 'UPDATE Failed - uid=' + uid + ' : err = ' + err, params);
                    return addUpdate("failed", "update", hash, uid, err, itemCallback);
                  }
                  syncUtil.doLog(dataset_id, 'info', 'UPDATE Success - uid=' + uid + ' : hash = ' + hash, params);
                  return addUpdate("applied", "update", hash, uid, '', itemCallback);
                }, meta_data);
              } else {
                var postHash = hashingFunction(post, uid);
                if (postHash === dataHash) {
                  // Update has already been applied
                  syncUtil.doLog(dataset_id, 'info', 'UPDATE Already Applied - uid=' + uid + ' : hash = ' + hash, params);
                  return addUpdate("applied", "update", hash, uid, '', itemCallback);
                }
                else {
                  syncUtil.doLog(dataset_id, 'warn', 'UPDATE COLLISION \n Pre record from client:\n' + util.inspect(syncUtil.sortObject(pre)) + '\n Current record from data store:\n' + util.inspect(syncUtil.sortObject(data)), params);
                  DataSetModel.doCollisionHandler(dataset_id, hash, timestamp, uid, pre, post, meta_data);
                  return addUpdate("collisions", "update", hash, uid, '', itemCallback);
                }
              }
            }, meta_data);
          }
          else if ("delete" === action) {
            syncUtil.doLog(dataset_id, 'verbose', 'DELETE Start', params);
            DataSetModel.doReadHandler(dataset_id, uid, function (err, data) {
              if (err) {
                syncUtil.doLog(dataset_id, 'warn', 'READ for DELETE Failed - uid=' + uid + ' : err = ' + err, params);
                return addUpdate("failed", "delete", hash, uid, err, itemCallback);
              }
              syncUtil.doLog(dataset_id, 'verbose', ' READ for DELETE Success', params);
              syncUtil.doLog(dataset_id, 'silly', ' READ for DELETE Data : \n' + util.inspect(data), params);

              var preHash = hashingFunction(pre, uid);
              var dataHash = hashingFunction(data, uid);

              syncUtil.doLog(dataset_id, 'verbose', 'DELETE Hash Check ' + uid + ' (client :: dataStore) = ' + preHash + ' :: ' + dataHash, params);

              if (!dataHash) {
                //record has already been deleted
                syncUtil.doLog(dataset_id, 'info', 'DELETE Already performed - uid=' + uid + ' : hash = ' + hash, params);
                return addUpdate("applied", "delete", hash, uid, '', itemCallback);
              }
              else {
                if (preHash === dataHash) {
                  DataSetModel.doDeleteHandler(dataset_id, uid, function (err) {
                    if (err) {
                      syncUtil.doLog(dataset_id, 'warn', 'DELETE Failed - uid=' + uid + ' : err = ' + err, params);
                      return addUpdate("failed", "delete", hash, uid, err, itemCallback);
                    }
                    syncUtil.doLog(dataset_id, 'info', 'DELETE Success - uid=' + uid + ' : hash = ' + hash, params);
                    return addUpdate("applied", "delete", hash, uid, '', itemCallback);
                  }, meta_data);
                } else {
                  syncUtil.doLog(dataset_id, 'warn', 'DELETE COLLISION \n Pre record from client:\n' + util.inspect(syncUtil.sortObject(pre)) + '\n Current record from data store:\n' + util.inspect(syncUtil.sortObject(data)), params);
                  DataSetModel.doCollisionHandler(dataset_id, hash, timestamp, uid, pre, post, meta_data);
                  return addUpdate("collisions", "delete", hash, uid, '', itemCallback);
                }
              }
            }, meta_data);
          }
          else {
            syncUtil.doLog(dataset_id, 'warn', 'unknown action : ' + action, params);
            itemCallback();
          }
        }, next);
    }
  ], cb);
}

function returnUpdates(dataset_id, params, resIn, cb) {
  //syncUtil.doLog(dataset_id, 'verbose', 'START returnUpdates', params);
  syncUtil.doLog(dataset_id, 'silly', 'returnUpdates - existing res = ' + util.inspect(resIn), params);
  var cuid = syncUtil.getCuid(params);
  fhdb({
    "act": "list",
    "type": dataset_id + "-updates",
    "eq": {
      "cuid": cuid
    }
  }, function (err, res) {
    if (err) return cb(err);

    var updates = {};

    syncUtil.doLog(dataset_id, 'silly', 'returnUpdates - found ' + res.list.length + ' updates', params);

    for (var di = 0, dl = res.list.length; di < dl; di += 1) {
      var rec = res.list[di].fields;
      if (!updates.hashes) {
        updates.hashes = {};
      }
      updates.hashes[rec.hash] = rec;

      if (!updates[rec.type]) {
        updates[rec.type] = {};
      }
      updates[rec.type][rec.hash] = rec;

      syncUtil.doLog(dataset_id, 'verbose', 'returning update ' + util.inspect(rec), params);
    }

    if (!resIn) {
      syncUtil.doLog(dataset_id, 'silly', 'returnUpdates - initialising res', params);
      resIn = {};
    }
    resIn.updates = updates;
    syncUtil.doLog(dataset_id, 'silly', 'returnUpdates - final res = ' + util.inspect(resIn), params);
    if (res.list.length > 0) {
      syncUtil.doLog(dataset_id, 'verbose', 'returnUpdates :: ' + util.inspect(updates.hashes), params);
    }

    DataSetModel.doResponseInterceptor(dataset_id, params.query_params, function (err) {
      if (err) {
        return cb(err, null);
      }
      else {
        return cb(null, resIn);
      }
    });
  });
}

function acknowledgeUpdates(dataset_id, params, cb) {

  var updates = params.acknowledgements;

  if (updates && updates.length > 0) {
    syncUtil.doLog(dataset_id, 'verbose', 'acknowledgeUpdates :: ' + util.inspect(updates), params);

    async.forEachSeries(updates, function (update, itemCallback) {
        syncUtil.doLog(dataset_id, 'verbose', 'acknowledgeUpdates :: processing update ' + util.inspect(update), params);
        fhdb({
          "act": "list",
          "type": dataset_id + "-updates",
          "eq": {
            "cuid": update.cuid,
            "hash": update.hash
          }
        }, function (err, res) {
          if (err) return itemCallback(err, update);

          if (res && res.list && res.list.length > 0) {
            var rec = res.list[0];
            var uid = rec.guid;
            fhdb({
              "act": "delete",
              "type": dataset_id + "-updates",
              "guid": uid
            }, function (err) {
              if (err) return itemCallback(err, update);

              return itemCallback(null, update);
            });
          }
          else {
            return itemCallback(null, update);
          }
        });
      },
      function (err) {
        if (err) {
          syncUtil.doLog(dataset_id, 'info', 'END acknowledgeUpdates - err=' + err, params);
        }
        cb(err);
      });
  }
  else {
    cb();
  }
}

/* Synchronise the individual records for a dataset */
function doSyncRecords(dataset_id, params, callback) {
  syncUtil.doLog(dataset_id, 'verbose', 'doSyncRecords', params);
  // Verify that query_param have been passed
  if (!params || !params.query_params) {
    return callback("no_query_params", null);
  }

  DataSetModel.getDatasetClient(dataset_id, params, function (err, datasetClient) {
    if (err) {
      return callback(err, null);
    }

    var updateRecords = function (data, callback) {
      // We have a data set for this dataset_id and query hash - compare the uid and hash values of
      // our records with the record received
      var serverRecs = data.records;
      var creates = {};
      var updates = {};
      var deletes = {};
      var i;

      var clientRecs = {};
      if (params && params.clientRecs) {
        clientRecs = params.clientRecs;
      }

      for (i in serverRecs) {
        var serverRec = serverRecs[i];
        var serverRecUid = i;
        var serverRecHash = serverRec.hash;

        if (clientRecs[serverRecUid]) {
          if (clientRecs[serverRecUid] !== serverRecHash) {
            syncUtil.doLog(dataset_id, 'verbose', 'Updating client record ' + serverRecUid + ' client hash=' + clientRecs[serverRecUid], params);
            updates[serverRecUid] = serverRec;
          }
        } else {
          syncUtil.doLog(dataset_id, 'verbose', 'Creating client record ' + serverRecUid, params);
          creates[serverRecUid] = serverRec;
        }
      }

      // Itterate over each of the client records. If there is no corresponding server record then mark the client
      // record for deletion
      for (i in clientRecs) {
        if (!serverRecs[i]) {
          syncUtil.doLog(dataset_id, 'verbose', 'Deleting client record ' + serverRecs[i], params);
          deletes[i] = {};
        }
      }

      var res = {"create": creates, "update": updates, "delete": deletes, "hash": datasetClient.dataHash};
      callback(null, res);
    };

    DataSetModel.forceSyncList(dataset_id, datasetClient, function (err, data) {
      if (err) return callback(err);
      updateRecords(data, callback);
    });
  });
}

/* ======================================================= */
/* ================== PRIVATE VARIABLES ================== */
/* ======================================================= */

// Functions which can be invoked through sync.doInvoke
var invokeFunctions = {
  "sync": doClientSync,
  "syncRecords": doSyncRecords,
  "listCollisions": doListCollisions,
  "removeCollision": doRemoveCollision,
  "setLogLevel": doSetLogLevel
};
