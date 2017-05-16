var packageJSON = require('../package.json');
var initScript = require('./init.js');
var EventEmitter = require('events').EventEmitter;

//IMPORTANT: This will force node to ignore cert errors for https requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function getDBUrl(api, callback) {
  if (process.env.SYNC_MONGODB_URL) {
    return callback(null, process.env.SYNC_MONGODB_URL);
  } else {
    callback("SYNC_MONGODB_URL environment variable is missing");
  }
}

/**
 * Feedhenry mobile sync cloud library
 */
function FHapi() {
  var api = {
    getVersion: function(){
      //Getting The Version of fh-mbaas-api
      return packageJSON.version;
    },
    events: new EventEmitter(),
    sync: require('./sync').api,
  };

  api.sync.setEventEmitter(api.events);

  var redisUrl = 'redis://' + api.redisHost + ':' + api.redisPort;

  getDBUrl(api, function(err, connectionString) {
    if (err) {
      console.warn('Warning! Could not get a mongodb connection string. Sync will not work. (', err, ')');
      return;
    } else if (!connectionString) {
      console.warn('Warning! Could not get a mongodb connection string. Sync will not work. If running in a Dynofarm/FeedHenry MBaaS, ensure the database is upgraded');
      return;
    }
    var poolSize = parseInt(process.env.SYNC_MONGODB_POOLSIZE) || 50;
    api.sync.connect(connectionString, {poolSize: poolSize}, redisUrl, function(err) {
      if (err) {
        console.error('Error starting the sync server (', err, ')');
      }
    });
  });

  api.mbaasExpress = function (opts) {
    opts = opts || {};
    opts.api = api;
    return require('fh-mbaas-express')(opts);
  };

  api.shutdown = function (cb) {
    // Sync service has a setInterval loop running which will prevent fh-mbaas-api from exiting cleanly.
    // Call stopAll to ensure Sync exits clenaly.
    api.sync.stopAll(cb);
  };

  return api;
}

/**
 * Initilisation returns the $fh object to clients
 */
module.exports = (function () {
  // First setup the required config params from  env variables
  var millicore = process.env.FH_MILLICORE || 'NO-MILLICORE-DEFINED';
  var domain = process.env.FH_DOMAIN || 'NO-DOMAIN-DEFINED';
  var instance = process.env.FH_INSTANCE || 'NO-INSTANCE-DEFINED';
  var appname = process.env.FH_APPNAME || 'NO-APPNAME-DEFINED';
  var widget = process.env.FH_WIDGET || 'NO-WIDGET-DEFINED';

  var redis_host = process.env.OPENSHIFT_REDIS_HOST || process.env.FH_REDIS_HOST || process.env.REDIS_SERVICE_HOST || "127.0.0.1";
  var redis_port = process.env.OPENSHIFT_REDIS_PORT || process.env.FH_REDIS_PORT || process.env.REDIS_SERVICE_PORT || 6379;
  var redis_password = process.env.REDIS_PASSWORD || process.env.FH_REDIS_PASSWORD;
  var appapikey = process.env.FH_APP_API_KEY || '';

  // Now build a config object to init the fh server APIs with

  var cfg = {
    fhapi: {
      appname: appname,
      millicore: millicore,
      port: 443,
      domain: domain,
      instance: instance,
      widget: widget,
      appapikey: appapikey
    },
    redis: {
      host: redis_host,
      port: redis_port,
      password: redis_password
    },
    socketTimeout: 60000,
  };

  initScript();
  return FHapi(cfg);
})();
