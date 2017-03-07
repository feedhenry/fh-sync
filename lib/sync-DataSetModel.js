var util = require('util');
var async = require('async');
var defaultDataHandler = require('./sync-datahandler');
var syncUtil = require('./sync-util');

/**
 * Removes code duplication and adds safety by ensuring global handlers passed
 * in are functions and not some other type.
 * @param  {String} handlerName The name of the handler, e.g "globalHandleRead"
 * @param  {Object} inst        The instance to set it on if valid
 * @return {Function}
 */
function generateGlobalSetter (handlerName, inst) {
  return function _setGlobalHandler (handlerFn) {
    syncUtil.ensureHandlerIsFunction(handlerName, handlerFn);
    inst[handlerName] = handlerFn;
  };
}

var self = {

  globalListHandler: undefined,
  globalCreateHandler: undefined,
  globalReadHandler: undefined,
  globalUpdateHandler: undefined,
  globalDeleteHandler: undefined,
  globalCollisionHandler: undefined,
  globalCollisionLister: undefined,
  globalCollisionRemover: undefined,
  globalHashHandler: defaultDataHandler.doHash,
  globalRequestInterceptor: function (dataset_id, params, cb) {
    return cb()
  },
  globalResponseInterceptor: function (dataset_id, params, cb) {
    return cb();
  },
  defaults: {
    "syncFrequency": 10,
    "clientSyncTimeout": 15,
    "logLevel": "info"
  },

  datasets: {},
  datasetClientRecords: {},
  deletedDatasets: {},
  createDatasetOnDemand: true,

  stopAllSync: false,

  setFHDB: function (db) {
    defaultDataHandler.setFHDB(db);
  },


  /**
   * Returns the hash fn for hashing records for a given dataset
   * @param  {String}   dataset_id
   * @param  {Function} callback
   * @return {undefined}
   */
  getHashFunction: function (dataset_id, callback) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) {
        return callback(err);
      }

      callback(null, dataset.hashHandler || self.globalHashHandler);
    });
  },


  /**
   * Passes the hashing function that should be used for records as a success
   * parameter to the supplied callback
   * @param   {String} dataset_id
   * @param   {Function} callback
   * @return  {undefined}
   */
  generateRecordHashes: function (dataset_id, records, callback) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) {
        return callback(err);
      }

      var hashFn = dataset.hashHandler || self.globalHashHandler;

      var hashes = [];
      var recOut = {};
      for (var i in records) {
        var rec = {};
        var recData = records[i];
        var hash = hashFn(recData, i); // pass the record and its id
        hashes.push(hash);
        rec.data = recData;
        rec.hash = hash;
        recOut[i] = rec;
      }
      var globalHash = syncUtil.generateHash(hashes);

      callback(null, {
        hash: globalHash,
        records: recOut
      });
    });
  },

  doListHandler: function (dataset_id, query_params, cb, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.listHandler) {
        dataset.listHandler(dataset_id, query_params, cb, meta_data);
      }
      else {
        self.globalListHandler(dataset_id, query_params, cb, meta_data);
      }
    });
  },

  doCreateHandler: function (dataset_id, data, cb, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.createHandler) {
        dataset.createHandler(dataset_id, data, cb, meta_data);
      }
      else {
        self.globalCreateHandler(dataset_id, data, cb, meta_data);
      }
    });
  },

  doReadHandler: function (dataset_id, uid, cb, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.readHandler) {
        dataset.readHandler(dataset_id, uid, cb, meta_data);
      }
      else {
        self.globalReadHandler(dataset_id, uid, cb, meta_data);
      }
    });
  },

  doUpdateHandler: function (dataset_id, uid, data, cb, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.updateHandler) {
        dataset.updateHandler(dataset_id, uid, data, cb, meta_data);
      }
      else {
        self.globalUpdateHandler(dataset_id, uid, data, cb, meta_data);
      }
    });
  },

  doDeleteHandler: function (dataset_id, uid, cb, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.deleteHandler) {
        dataset.deleteHandler(dataset_id, uid, cb, meta_data);
      }
      else {
        self.globalDeleteHandler(dataset_id, uid, cb, meta_data);
      }
    });
  },

  doCollisionHandler: function (dataset_id, hash, timestamp, uid, pre, post, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.collisionHandler) {
        dataset.collisionHandler(dataset_id, hash, timestamp, uid, pre, post, meta_data);
      }
      else {
        self.globalCollisionHandler(dataset_id, hash, timestamp, uid, pre, post, meta_data);
      }
    });
  },

  doCollisionLister: function (dataset_id, cb, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.collisionLister) {
        dataset.collisionLister(dataset_id, cb, meta_data);
      }
      else {
        self.globalCollisionLister(dataset_id, cb, meta_data);
      }
    });
  },

  doCollisionRemover: function (dataset_id, hash, cb, meta_data) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.collisionRemover) {
        dataset.collisionRemover(dataset_id, hash, cb, meta_data);
      }
      else {
        self.globalCollisionRemover(dataset_id, hash, cb, meta_data);
      }
    });
  },

  doRequestInterceptor: function (dataset_id, params, cb) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.requestInterceptor) {
        dataset.requestInterceptor(dataset_id, params, cb);
      }
      else {
        self.globalRequestInterceptor(dataset_id, params, cb);
      }
    });
  },

  doResponseInterceptor: function (dataset_id, params, cb) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return cb(err);
      if (dataset.responseInterceptor) {
        dataset.responseInterceptor(dataset_id, params, cb);
      }
      else {
        self.globalResponseInterceptor(dataset_id, params, cb);
      }
    });
  },

  getDataset: function (dataset_id, cb) {

    // TODO - Persist data sets - in memory or more permanently ($fh.db())
    if (self.deletedDatasets[dataset_id]) {
      return cb("unknown_dataset - " + dataset_id, null);
    }
    else {
      var dataset = self.datasets[dataset_id];
      if (!dataset) {
        if (self.createDatasetOnDemand) {
          return self.createDataset(dataset_id, {}, cb);
        }
        else {
          return cb("unknown_dataset - " + dataset_id, null);
        }
      }
      else {
        return cb(null, dataset);
      }
    }
  },

  createDataset: function (dataset_id, options, cb) {
    syncUtil.doLog(dataset_id, 'info', 'createDataset');
    var datasetConfig = JSON.parse(JSON.stringify(self.defaults));
    if (options) {
      for (var i in options) {
        if (options.hasOwnProperty(i)) {
          datasetConfig[i] = options[i];
        }
      }
    }

    syncUtil.setLogger(dataset_id, datasetConfig);

    delete self.deletedDatasets[dataset_id];

    var dataset = self.datasets[dataset_id];
    if (!dataset) {
      dataset = {
        id: dataset_id,
        created: new Date().getTime(),
        clients: {},
        config: datasetConfig
      }
      self.datasets[dataset_id] = dataset;
    }
    cb(null, dataset);
  },

  removeDataset: function (dataset_id, cb) {

    // TODO - Persist data sets - in memory or more permanently ($fh.db())
    self.deletedDatasets[dataset_id] = new Date().getTime();

    delete self.datasets[dataset_id];

    cb(null, {});
  },

  stopDatasetSync: function (dataset_id, cb) {
    syncUtil.doLog(dataset_id, 'info', 'stopDatasetSync');
    self.getDataset(dataset_id, function (err) {
      if (err) {
        return cb(err);
      }
      self.removeDataset(dataset_id, cb);
    });
  },

  stopAllDatasetSync: function (cb) {
    syncUtil.doLog(syncUtil.SYNC_LOGGER, 'info', 'stopAllDatasetSync');

    var stoppingDatasets = [];
    for (var dsId in self.datasets) {
      if (self.datasets.hasOwnProperty(dsId)) {
        stoppingDatasets.push(self.datasets[dsId]);
      }
    }

    var stoppedDatasets = [];

    async.forEachSeries(stoppingDatasets, function (dataset, itemCallback) {
        stoppedDatasets.push(dataset.id);
        self.stopDatasetSync(dataset.id, itemCallback);
      },
      function (err) {
        self.stopAllSync = true;
        cb(err, stoppedDatasets);
      });
  },

  getDatasetClient: function (dataset_id, params, cb) {
    // Verify that query_param have been passed
    if (!params || !params.query_params) {
      return cb("no_query_params", null);
    }

    var query_params = params.query_params;
    var meta_data = params.meta_data || {};

    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return err;
      var clientHash = self.getClientHash(query_params, meta_data);
      var datasetClient = dataset.clients[clientHash];
      if (!datasetClient) {
        self.createDatasetClient(dataset_id, query_params, meta_data, function (err, dsc) {
          if (err) return cb(err);
          recordAccessInfo(dsc, params);
          return cb(null, dsc);
        });
      }
      else {
        recordAccessInfo(datasetClient, params);
        return cb(null, datasetClient);
      }
    });

    function recordAccessInfo(datasetClient, params) {
      datasetClient.lastAccessed = new Date().getTime();
      datasetClient.syncActive = true;

      var cuid = syncUtil.getCuid(params);

      if (!cuid) {
        return;
      }

      if (!datasetClient.instances[cuid]) {
        datasetClient.instances[cuid] = {
          config: params.config || {}
        }
      }
      datasetClient.instances[cuid].lastAccess = new Date().getTime();
    }
  },

  getDatasetClientRecords: function (datasetClient, cb) {
    var datasetClientId = datasetClient.id;
    if (typeof self.datasetClientRecords[datasetClientId] !== "undefined") {
      return cb(null, self.datasetClientRecords[datasetClientId]);
    } else {
      var datasetId = datasetClient.datasetId;
      syncUtil.doLog(datasetId, 'silly', 'no data records found for datasetClient ' + datasetClientId + '. Do backend list.');
      self.syncDatasetClient(datasetClient, function (err) {
        if (err) return cb(err);
        return cb(null, self.datasetClientRecords[datasetClientId]);
      });
    }
  },

  createDatasetClient: function (dataset_id, query_params, meta_data, cb) {
    self.getDataset(dataset_id, function (err, dataset) {
      if (err) return err;
      var clientHash = dataset_id + "_" + self.getClientHash(query_params, meta_data);
      var datasetClient = dataset.clients[clientHash];
      if (!datasetClient) {
        datasetClient = {
          id: clientHash,
          datasetId: dataset_id,
          created: new Date().getTime(),
          lastAccessed: new Date().getTime(),
          queryParams: query_params,
          metaData: meta_data,
          syncRunning: false,
          syncPending: true,
          syncActive: true,
          pendingCallbacks: [],
          instances: {}
        };
        dataset.clients[clientHash] = datasetClient;
      }
      syncUtil.doLog(dataset_id, 'verbose', 'createDatasetClient :: ' + util.inspect(datasetClient));
      return cb(null, datasetClient);
    });
  },

  removeDatasetClient: function (datasetClient, cb) {
    if (datasetClient && datasetClient.id) {
      delete dataset.clients[datasetClient.id];
    }
    cb();
  },

  syncDatasetClient: function (datasetClient, cb) {
    datasetClient.syncPending = true;
    syncUtil.doLog(datasetClient.datasetId, 'silly', 'pushing cb to pendingCallbacks of datasetcClient id = ' + datasetClient.id, datasetClient);
    datasetClient.pendingCallbacks.push(function (err, res) {
      cb(err, res);
    });
    syncUtil.doLog(datasetClient.datasetId, 'silly', 'Now there are ' + datasetClient.pendingCallbacks.length + ' calbacks for datasetclient id =' + datasetClient.id, datasetClient);
  },

  getClientHash: function (query_params, meta_data) {
    var queryParamsHash = syncUtil.generateHash(query_params);
    var metaDataHash = syncUtil.generateHash(meta_data);

    return queryParamsHash + '-' + metaDataHash;
  },

  doSyncList: function (dataset, datasetClient, cb) {
    datasetClient.syncRunning = true;
    datasetClient.syncPending = false;
    datasetClient.syncLoopStart = new Date().getTime();

    async.waterfall(
      [
        function (next) {
          self.doListHandler(dataset.id, datasetClient.queryParams, next, datasetClient.metaData);
        },
        function (records, next) {
          self.generateRecordHashes(dataset.id, records, next);
        },
        function (hashes, next) {
          var globalHash = hashes.hash;

          var previousHash = datasetClient.dataHash ? datasetClient.dataHash : '<undefined>';
          syncUtil.doLog(dataset.id, 'verbose', 'doSyncList cb ' + ( cb !== undefined) + ' - Global Hash (prev :: cur) = ' + previousHash + ' ::  ' + globalHash);

          datasetClient.dataHash = globalHash;
          self.datasetClientRecords[datasetClient.id] = hashes.records;

          datasetClient.syncRunning = false;
          datasetClient.syncLoopEnd = new Date().getTime();

          next(null, hashes);
        }
      ],
      function (err, hashes) {
        if (err) {
          datasetClient.syncRunning = false;
          datasetClient.syncLoopEnd = new Date().getTime();
          return cb && cb(err);
        } else {
          if (cb) {
            cb(null, hashes);
          }
        }
      }
    );
  },

  forceSyncList: function (dataset_id, datasetClient, cb) {

    self.doListHandler(dataset_id, datasetClient.queryParams, function (err, records) {
      if (err) return cb(err);

      self.generateRecordHashes(dataset_id, records, cb);

    }, datasetClient.metaData);
  },

  doSyncLoop: function () {
    var syncList=function (datasetClient) {
      self.doSyncList(dataset, datasetClient, function (err, res) {
        // Check if there are aby pending callbacks for this sync Client;
        var pendingCallbacks = datasetClient.pendingCallbacks;
        syncUtil.doLog(dataset_id, 'verbose', 'found ' + pendingCallbacks.length + ' callbacks for datasetClient ' + datasetClient.id);
        datasetClient.pendingCallbacks = [];

        var syncFunction = function (i) {
          syncUtil.doLog(dataset_id, 'verbose', 'finished running sync for client - invoking callback #' + i);
          var cb = pendingCallbacks[i];
          // Use process.nextTick so we can complete the syncLoop before all the callbacks start to fire
          function invokeCb() {
            cb(err, res);
          }
          process.nextTick(invokeCb);
        };
        for (var i = 0; i < pendingCallbacks.length; i++) {
          syncFunction(i);
        }
      });
    }

    for (var dataset_id in self.datasets) {
      if (self.datasets.hasOwnProperty(dataset_id)) {
        var dataset = self.datasets[dataset_id];
        for (var datasetClientId in dataset.clients) {
          if (dataset.clients.hasOwnProperty(datasetClientId)) {
            var datasetClient = dataset.clients[datasetClientId];
            if (!datasetClient.syncRunning && datasetClient.syncActive) {
              // Check to see if it is time for the sync loop to run again
              var lastSyncStart = datasetClient.syncLoopStart;
              var lastSyncCmp = datasetClient.syncLoopEnd;
              if (lastSyncStart === null) {
                syncUtil.doLog(dataset_id, 'verbose', 'Performing initial sync');
                // Dataset has never been synced before - do initial sync
                datasetClient.syncPending = true;
              } else if (lastSyncCmp !== null) {
                // Check to see if this sync needs to be deactivated because
                // of lack of active clients.
                var timeSinceLastSync = new Date().getTime() - lastSyncCmp;
                var lastAccessed = datasetClient.lastAccessed;
                var syncClientTimeout = dataset.config.clientSyncTimeout * 1000;
                var now = new Date().getTime();
                if (lastAccessed + syncClientTimeout < now) {
                  syncUtil.doLog(dataset_id, 'info', 'Deactivating sync for client ' + datasetClient.id + '. No client instances have accessed in ' + syncClientTimeout + 'ms');
                  datasetClient.syncActive = false;
                  delete self.datasetClientRecords[datasetClient.id];
                }
                else {
                  var syncFrequency = dataset.config.syncFrequency * 1000;
                  if (timeSinceLastSync > syncFrequency) {
                    // Time between sync loops has passed - do another sync
                    datasetClient.syncPending = true;
                  }
                }
              }
              if (datasetClient.syncPending) {
                syncUtil.doLog(dataset_id, 'verbose', 'running sync for client ' + datasetClient.id);
                // If the dataset requres syncing, run the sync loop. This may be because the sync interval has passed
                // or because the syncFrequency has been changed or because the syncPending flag was deliberately set
                // important: use the closure here to make sure the 'datasetClient' object doens't change to another one in the doSyncList callback (as the for loop will contiune to run)
                syncList(datasetClient)
              }
            }
          }
        }
      }
    }
  },

  setDefaultHandlers: function () {
    self.globalListHandler = defaultDataHandler.doList;
    self.globalCreateHandler = defaultDataHandler.doCreate;
    self.globalReadHandler = defaultDataHandler.doRead;
    self.globalUpdateHandler = defaultDataHandler.doUpdate;
    self.globalDeleteHandler = defaultDataHandler.doDelete;
    self.globalCollisionHandler = defaultDataHandler.doCollision;
    self.globalCollisionLister = defaultDataHandler.listCollisions;
    self.globalCollisionRemover = defaultDataHandler.removeCollision;
  },

  toJSON: function (dataset_id, returnData, cb) {
    var res = {};

    var addData = function (dataset) {
      for (var i in dataset.clients) {
        if (dataset.clients.hasOwnProperty(i)) {
          var dsc = dataset.clients[i];
          dsc.dataRecords = self.datasetClientRecords[dsc.id];
        }
      }
    }

    if (!dataset_id) {
      // return entire sync object
      res = JSON.parse(JSON.stringify(self.datasets));
      if (returnData) {
        for (var i in res) {
          if (res.hasOwnProperty(i)) {
            var dataset = res[i];
            addData(dataset);
          }
        }
      }
      return cb(null, res);
    }
    else {
      self.getDataset(dataset_id, function (err) {
        if (err) return cb(err);

        if (returnData) {
          addData(res);
        }
        return cb(null, res);
      });
    }


  },

  datasetMonitor: function () {
    self.doSyncLoop();
    if (!self.stopAllSync) {
      // Re-execute datasetMonitor every 500ms so we keep invoking doSyncLoop();
      setTimeout(function () {
        self.datasetMonitor();
      }, 500);
    }
  }
};

var init = function () {
  syncUtil.setLogger(syncUtil.SYNC_LOGGER, {logLevel: self.defaults.logLevel});

  syncUtil.doLog(syncUtil.SYNC_LOGGER, 'verbose', 'DataSetModel Init');

  self.setDefaultHandlers();

  self.datasetMonitor();
};


module.exports = {
  forceSyncList: self.forceSyncList,
  setGlobalListHandler: generateGlobalSetter('globalListHandler', self),
  setGlobalCreateHandler: generateGlobalSetter('globalCreateHandler', self),
  setGlobalReadHandler: generateGlobalSetter('globalReadHandler', self),
  setGlobalUpdateHandler: generateGlobalSetter('globalUpdateHandler', self),
  setGlobalDeleteHandler: generateGlobalSetter('globalDeleteHandler', self),
  setGlobalCollisionHandler: generateGlobalSetter('globalCollisionHandler', self),
  setGlobalCollisionLister: generateGlobalSetter('globalCollisionLister', self),
  setGlobalCollisionRemover: generateGlobalSetter('globalCollisionRemover', self),
  setGlobalRequestInterceptor: generateGlobalSetter('globalRequestInterceptor', self),
  setGlobalResponseInterceptor: generateGlobalSetter('globalResponseInterceptor', self),
  setGlobalHashHandler: generateGlobalSetter('globalHashHandler', self),
  generateRecordHashes: self.generateRecordHashes,
  getHashFunction: self.getHashFunction,
  doHashHandler: self.doHashHandler,
  doListHandler: self.doListHandler,
  doCreateHandler: self.doCreateHandler,
  doReadHandler: self.doReadHandler,
  doUpdateHandler: self.doUpdateHandler,
  doDeleteHandler: self.doDeleteHandler,
  doCollisionHandler: self.doCollisionHandler,
  doCollisionLister: self.doCollisionLister,
  doCollisionRemover: self.doCollisionRemover,
  doRequestInterceptor: self.doRequestInterceptor,
  doResponseInterceptor: self.doResponseInterceptor,
  stopDatasetSync: self.stopDatasetSync,
  stopAllDatasetSync: self.stopAllDatasetSync,
  getDataset: self.getDataset,
  createDataset: self.createDataset,
  removeDataset: self.removeDataset,
  getDatasetClient: self.getDatasetClient,
  getDatasetClientRecords: self.getDatasetClientRecords,
  createDatasetClient: self.createDatasetClient,
  removeDatasetClient: self.removeDatasetClient,
  syncDatasetClient: self.syncDatasetClient,
  getClientHash: self.getClientHash,
  toJSON: self.toJSON,
  setFHDB: self.setFHDB,
  init: init
}
