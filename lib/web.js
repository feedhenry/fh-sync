var redis = require("redis"),
  assert = require('assert'),
  util = require('util'),
  http = require('http'),
  https = require('https'),
  helpers = require('./web-helpers'),
  redisPort = 6379,
  redisHost = '127.0.0.1',
  redisPassword,
  cfg;

redisPort = parseInt(redisPort, 10);
if (!isNaN(redisPort)) {
  redisPort = 6379;
}


// redisClient function
var redisClient = function (cfg) {
// DynoFarm overrides
  if (cfg && cfg.redis) {
    if (cfg.redis.host) redisHost = cfg.redis.host;
    if (cfg.redis.port) redisPort = cfg.redis.port;
    if (cfg.redis.password) redisPassword = cfg.redis.password;
  }

  var client = redis.createClient(redisPort, redisHost);
  if (redisPassword) {
    client.auth(redisPassword);
  }
  return client;
};


function loadWebCache(fhOptions, callback) {
  if (!fhOptions.period) return callback();
  var client = redisClient();
  client.on("connect", function () {
    if (redisPassword) {
      client.auth(redisPassword, function (err) {
        if (err) callback(err);
      });
    }
  });
  client.on("error", function (err) {
    return callback(err);
  });
  client.on("ready", function (err) {
    if (err) return callback(err);
    var key = cfg.fhapi.appname + helpers.webCacheKey(fhOptions);
    client.get(key, function (err, reply) {
      client.quit();
      return callback(err, reply);
    });
  });
}

function saveWebCache(fhOptions, data, callback) {
  if (!fhOptions.period) return callback();
  var client = redisClient();
  client.on("connect", function () {
    if (redisPassword) {
      client.auth(redisPassword, function (err) {
        if (err) callback(err);
      });
    }
  });
  client.on("error", function (err) {
    return callback(err);
  });
  client.on("ready", function (err) {
    if (err) return callback(err);
    var key = cfg.fhapi.appname + helpers.webCacheKey(fhOptions);
    client.setex(key, (fhOptions.period / 1000), data, function (err, reply) {
      client.quit();
      return callback(err, {key: key, reply: reply});
    });
  });
}

// $fh.web
module.exports = function (config) {
  assert.ok(config, 'cfg is undefined');
  cfg = config;
  return function (fhOptions, callback) {
    console.warn('Warning: $fh.web is deprecated - please use request instead. See: http://github.com/mikeal/request');
    if (!callback) {
      throw new Error('callback undefined in $fh.web. See documentation of $fh.web for proper usage');
    }
    // purposely ignore any err from looking in the cache
    loadWebCache(fhOptions, function (err, resp) {
      if (resp) {
        //make report
        return callback(undefined, JSON.parse(resp));
      }
      // not cached, so make request
      var nodeOptions = helpers.convertFHOptionsToNodeOptions(fhOptions);
      var fhResp = {};
      var protocol = nodeOptions.isSecure ? https : http;

      var req = protocol.request(nodeOptions, function (res) {
        var starttime = new Date().getTime();
        //
        // Note: $fh.web retun object constructed in the following format:
        // http://docs.feedhenry.com/wiki/Web_Requests
        //
        fhResp.status = res.statusCode;
        if (res.headers && res.headers['content-type']) {
          fhResp.contentType = res.headers['content-type'];
        }

        // TODO - transform Cookies into FH cookie array
        // TODO - headers is an object, FH.web expects an array returned
        fhResp.headers = res.headers;
        if (!fhOptions.charset) {
          res.setEncoding(fhOptions.charset);
        }

        var data = '';
        var bytesLength = 0;
        res.on('data', function (chunk) {
          data += chunk;
          bytesLength += data.length;
        });

        res.on('end', function () {
          fhResp.body = data;
          var endtime = new Date().getTime() - starttime;
          starttime = (starttime / 1000); //create unix timestamp

          //schedule report to be sent on nextTick
          try {
            var repurl = nodeOptions.host.toString() + nodeOptions.path.toString();
            var repdata = {
              'topic': "fhweb",
              'url': repurl,
              'time': endtime,
              'status': res.statusCode,
              'start': Number(starttime.toFixed(0)),
              'bytes': bytesLength
            };
            report.sendReport(repdata);
          } catch (e) {
            // console.log(e.message);
          }
          // save in the cache - note we do this after the callback has been invoked
          // note we also purposely ignore errors here, not much we can do with them..
          process.nextTick(function () {
            saveWebCache(fhOptions, JSON.stringify(fhResp), function (err) {
              if (err) console.error(err);
            });
          });
          callback(null, fhResp);
        });
      });
      req.on('error', function (e) {
        var msg = e ? util.inspect(e) : 'Undefined error making request';
        msg += " - request: " + util.inspect(nodeOptions);
        console.error('Error making request! - ' + msg);
        callback(msg);
      });

      if (fhOptions.body && fhOptions.method && fhOptions.method !== 'GET') {
        req.write(fhOptions.body);
      }
      req.end();
    });
  };
};
