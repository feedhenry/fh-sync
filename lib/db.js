var request = require('request'),
  fs = require('fs'),
  util = require('util'),
  mongodbUri = require('mongodb-uri'),
  assert = require('assert'),
  futils = require('./fhutils'),
  mbaasClient = require('fh-mbaas-client'),
  async = require('async'),
  logger,
  appname,
  config,
  ditch_host,
  fhutils,
  ditch_port;


// if we're running on OpenShift 2, then ensure that our FH_MONGODB_CONN_URL envvar is set when the module is loaded
// Some client apps e.g. Our generic Welcome app, use the presense of the envvar to indicate whether direct database calls can be made
function mongoConnectionStringOS2(cb){
  logger.debug('Running in OpenShift 2, constructing db connection string from additional env vars');
  var connectionString,
    host = process.env.OPENSHIFT_MONGODB_DB_HOST,
    user = process.env.OPENSHIFT_MONGODB_DB_USERNAME,
    pass = process.env.OPENSHIFT_MONGODB_DB_PASSWORD,
    port = process.env.OPENSHIFT_MONGODB_DB_PORT,
    dbname = process.env.OPENSHIFT_APP_NAME;
  connectionString = mongodbUri.format({
    username: user,
    password: pass,
    hosts: [
      {
        host: host,
        port: port
      }
    ],
    database: dbname
  });
  process.env.FH_MONGODB_CONN_URL = connectionString;
  return cb(undefined, process.env.FH_MONGODB_CONN_URL);

}

//use mbaas client
//set process.env.FH_MONGODB_CONN_URL to cache it
//
function mongoConnectionStringOS3(cb){

  logger.debug('Running in OpenShift 3, requesting db connection string from MBaaS');
  mbaasClient.app.databaseConnectionString({
    "domain":config.fhmbaas.domain,
    "environment":config.fhmbaas.environment
  }, function retrieved(err,resp){
    if (err)return cb(err);
    process.env.FH_MONGODB_CONN_URL = resp.url;
    return cb(undefined, resp.url);
  });
}

function getMongoConnectionUrl(cb){
  if(process.env.FH_MONGODB_CONN_URL){
    return cb(undefined, process.env.FH_MONGODB_CONN_URL);
  } else if (process.env.OPENSHIFT_MONGODB_DB_HOST) {
    return mongoConnectionStringOS2(cb);
  } else if ("openshift3" === process.env.FH_MBAAS_TYPE){
    return mongoConnectionStringOS3(cb);
  }else {
    logger.debug('no way to determine mongo connection string');
    return cb();
  }
}

module.exports = function (cfg) {
  assert.ok(cfg, 'cfg is undefined');
  config = cfg;
  logger = cfg.logger;
  appname = cfg.fhapi.appname;
  fhutils = new futils(config);
  // Ditch settings
  if (cfg && cfg.fhditch) {
    if (cfg.fhditch.host) ditch_host = cfg.fhditch.host;
    if (cfg.fhditch.port) ditch_port = cfg.fhditch.port;
  }
  return db;
};

// $fh.db
var db = function (params, callback) {
  var CONST_CONN_STRING = "connectionString";
  if (!params.act) throw new Error("'act' undefined in params. See documentation of $fh.db for proper usage");
  // Type required for all but list operations, where we can list collections by omitting the type param
  if (!(params.type) && ['close', 'list', 'export', 'import',CONST_CONN_STRING].indexOf(params.act) === -1) throw new Error("'type' undefined in params. See documentation of $fh.db for proper usage");
  if (!appname) throw new Error("Internal error - no appId defined");

  if (CONST_CONN_STRING  === params.act){
    return getMongoConnectionUrl(callback);
  }
  params.__fhdb = appname;

  //If there is a mongo connection url, then the one-db-per-app parameter must be set for the request
  //to alert ditcher the app has its own database.
  async.waterfall([
    getMongoConnectionUrl,
    function cacheConnectionString(connectionString, callback){
      //cache the connection string for the lifetime of this process
      if('string' === typeof connectionString) {
        process.env.FH_MONGODB_CONN_URL = connectionString;
      } else if ('function' === typeof connectionString) {
        callback = connectionString;
      }
      return callback();
    }
  ],function processMongoAction (err){
    if(err){
      return callback(err);
    }
    if (process.env.FH_MONGODB_CONN_URL) {
      params.__dbperapp = appname;
    }

    var fhdb = require('fh-db');
    if (process.env.FH_USE_LOCAL_DB || process.env.FH_MONGODB_CONN_URL) {
      return fhdb.local_db(params, callback);
    }
    else {
      //net_db should not be called by apps created using fh-webapp --
      if (process.env.FH_DB_PERAPP) {
        logger.error('attempt to use db per app with no data storage enabled');
        return callback(new Error("Data storage not enabled for this app. Please use the Data Browser window to enable data storage."));
      } else {
        logger.info('using net_db (DITCH)');
        return net_db(params, callback);
      }
    }
  });
};

function net_db(params, callback) {
  var headers = {"accept": "application/json"},
    url = config.fhditch.protocol + "://" + ditch_host + ":" + ditch_port + '/data/' + params.act,
    postData = {
      uri: url,
      method: 'POST',
      headers: headers,
      timeout: config.socketTimeout
    },
    req,
    requestArgs;
  headers["content-type"] = "application/json";
  fhutils.addAppApiKeyHeader(headers);

  // Otherwise, these get sent as form data
  if (!params.files) {
    postData.json = params;
  }

  requestArgs = [postData];

  if (params.act !== 'export') {
    // Only export requests get streamed - the rest use the normal callback mehcanism
    requestArgs.push(function (err, res, body) {
      if (err) {
        logger.error('Problem contacting DITCH server: ' + err.message + "\n" + util.inspect(err.stack));
        return callback(err);
      }
      return callback(null, body);
    });
  }

  req = request.apply(this, requestArgs);

  // if we're sending files, setup the request to use form data
  if (params.files) {
    var form = req.form();
    Object.keys(params.files).forEach(function (filekey) {
      var file = params.files[filekey];
      form.append(filekey, fs.createReadStream(file.path));
    });
    // Append all strings as form data
    Object.keys(params).forEach(function (paramkey) {
      var paramData = params[paramkey];
      if (typeof paramData === 'string') {
        form.append(paramkey, paramData);
      }
    });
  }

  if (params.act === 'export') {
    // Finish up a streaming request for exports
    req.on('error', function (err) {
      logger.warning('Problem contacting DITCH server: ' + err.message + "\n" + util.inspect(err.stack));
      return callback(err);
    });

    req.on('end', function () {
      return callback(null, {stream: req})
    });

    return callback(null, {stream: req});
  }
  return;
}
