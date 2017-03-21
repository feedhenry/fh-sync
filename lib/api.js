/*
 Copyright (c) FeedHenry 2011
 fh-api - the node.js implementation of $fh, feedhenry serverside APIs
 */
var sec = require('fh-security'),
  consolelogger = require('./consolelogger.js'),
  util = require('util');
var url = require('url');
var packageJSON = require('../package.json');
var initScript = require('./init.js');
var EventEmitter = require('events').EventEmitter;

var mbaasClient = require('fh-mbaas-client');

//IMPORTANT: This will force node to ignore cert errors for https requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//
// Main FHapi constructor function..
//
function FHapi(cfg, logr) {
  if (cfg) {
    cfg.logger = logr;
  }

  var api = {
    getVersion: function(){
      //Getting The Version of fh-mbaas-api
      return packageJSON.version;
    },
    cache: require('./cache')(cfg),
    db: require('./db')(cfg),
    events: new EventEmitter(),
    forms: require('./forms')(cfg),
    log: false,
    stringify: false,
    parse: false,
    push: require('./push')(cfg),
    call: require('./call')(cfg),
    util: false,
    redisPort: cfg.redis.port || '6379',
    redisHost: cfg.redis.host || 'localhost',
    session: require('./session')(cfg),
    stats: require('./stats')(cfg),
    sync: require('./sync').api,
    act: require('./act')(cfg),
    service: require('./act')(cfg),
    sec: sec.security,
    auth: require('./auth')(cfg),
    host: require('./host'),
    permission_map: require('fh-db').permission_map,
    hash: function (opts, callback) {
      var p = {
        act: 'hash',
        params: opts
      };
      sec.security(p, callback);
    },
    web: require('./web')(cfg)
  };

  api.sync.setEventEmitter(api.events);

  var redisUrl = 'redis://' + api.redisHost + ':' + api.redisPort;

  api.db({
    "act" : "connectionString"
  }, function(err, connectionString) {
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

  api.setLogLevel = function(level) {
    logr.setLogLevel(level);
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

  var ditch_host = process.env.FH_DITCH_HOST || 'localhost';
  var ditch_protocol = process.env.FH_DITCH_PROTOCOL || "https";
  var ditch_port;
  if (ditch_protocol === 'https') {
    ditch_port = process.env.FH_DITCH_PORT || 443;
  } else {
    ditch_port = process.env.FH_DITCH_PORT || 80;
  }
  var redis_host = process.env.OPENSHIFT_REDIS_HOST || process.env.FH_REDIS_HOST || process.env.REDIS_SERVICE_HOST || "127.0.0.1";
  var redis_port = process.env.OPENSHIFT_REDIS_PORT || process.env.FH_REDIS_PORT || process.env.REDIS_SERVICE_PORT || 6379;
  var redis_password = process.env.REDIS_PASSWORD || process.env.FH_REDIS_PASSWORD;
  var ua = process.env.FH_URBAN_AIRSHIP || '{}';
  var messaging_host = process.env.FH_MESSAGING_HOST || 'NO-MESSAGING-HOST-DEFINED';
  var messaging_cluster = process.env.FH_MESSAGING_CLUSTER || 'NO-MESSAGING-CLUSTER-DEFINED';
  var messaging_server = process.env.FH_MESSAGING_SERVER || 'NO-MESSAGING-SERVER-DEFINED';
  var messaging_recovery_file = process.env.FH_MESSAGING_RECOVERY_FILE || 'NO-RECOVERY-FILE-DEFINED';
  var messaging_protocol = process.env.FH_MESSAGING_PROTOCOL || "https";
  var messaging_backup_file = process.env.FH_MESSAGING_BACKUP_FILE || 'NO-BACKUP-FILE-DEFINED';
  var stats_host = process.env.FH_STATS_HOST || process.env.OPENSHIFT_FEEDHENRY_REPORTER_IP || 'localhost';
  var stats_port = process.env.FH_STATS_PORT || process.env.OPENSHIFT_FEEDHENRY_REPORTER_PORT || 8125;
  var stats_protocol = process.env.FH_STATS_PROTOCOL || "https";
  var stats_enabled = process.env.FH_STATS_ENABLED || false;
  var appapikey = process.env.FH_APP_API_KEY || '';
  var environment = process.env.FH_ENV || '';

  //MBAAS Host And Environment Access Key.
  var mbaas_host = process.env.FH_MBAAS_HOST || 'localhost';
  var mbaas_access_key = process.env.FH_MBAAS_ENV_ACCESS_KEY || '';
  var mbaas_protocol = process.env.FH_MBAAS_PROTOCOL || "https";

  var mbaas_url = url.parse(mbaas_protocol + "://" + mbaas_host);

  var logLevel = parseInt(process.env.MBAAS_LOG_LEVEL) || 2;

  try {
    ua = JSON.parse(ua);
  } catch (x) {
    console.error("Error parsing FH_URBAN_AIRSHIP: " + util.inspect(ua) + " err: " + util.inspect(x));
    ua = {};
  }

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
    fhditch: {
      host: ditch_host,
      port: ditch_port,
      protocol: ditch_protocol
    },
    fhmbaas: {
      environment: environment,
      domain: domain,
      mbaasConf: {
        url: url.format(mbaas_url),
        accessKey: mbaas_access_key,
        project: widget,
        app: instance,
        appApiKey: appapikey
      }
    },
    redis: {
      host: redis_host,
      port: redis_port,
      password: redis_password
    },
    fhmessaging: {
      host: messaging_host,
      cluster: messaging_cluster,
      msgServer: {
        logMessageURL: messaging_server
      },
      recoveryFiles: {
        fileName: messaging_recovery_file
      },
      backupFiles: {
        fileName: messaging_backup_file
      },
      protocol: messaging_protocol
    },
    fhstats: {
      host: stats_host,
      port: stats_port,
      enabled: stats_enabled,
      protocol: stats_protocol
    },
    urbanairship: ua,
    socketTimeout: 60000,
    APP_API_KEY_HEADER: 'X-FH-AUTH-APP'
  };

  //Initialising MbaasConfig To Make Forms Calls To FH-Mbaas
  mbaasClient.initEnvironment(cfg.fhmbaas.environment, cfg.fhmbaas.mbaasConf);

  var logger = new consolelogger.ConsoleLogger(logLevel);
  initScript(logger);
  return FHapi(cfg, logger);
})();
