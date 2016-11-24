var call, config, session;
var _ = require('underscore');

var ENDPOINT = 'admin/authpolicy/verifysession';
var DEFAULT_OPTS = {
  cache: true,
  expire: 60 * 60
};

function buildCacheKey(sessionToken){
  return 'fh_session_token_cache_' + sessionToken;
}

function verifyToken(sessionToken, cachekey, opts, cb) {
  call(ENDPOINT, {sessionToken: sessionToken}, function (err, res) {
    if (err) {
      return cb(err);
    } else {
      if (res.status && res.status === 200) {
        var body = (typeof res.body === 'string' ? JSON.parse(res.body) : res.body);
        if (opts.cache) {
          session.set(cachekey, res, opts.expire, function () {
            return cb(null, body.isValid);
          });
        } else {
          return cb(null, body.isValid);
        }
      } else {
        return cb(res);
      }
    }
  });
}

var auth = {
  verify: function (sessionToken, options, cb) {
    console.log('verify for sessionToken', sessionToken);
    if (sessionToken) {
      var opts = _.extend({}, DEFAULT_OPTS, options);
      var cachekey = buildCacheKey(sessionToken);
      if (opts.cache) {
        session.get(cachekey, function (err, data) {
          if (data) {
            return cb(null, data.isValid);
          } else {
            return verifyToken(sessionToken, cachekey, opts, cb);
          }
        });
      } else {
        return verifyToken(sessionToken, cachekey, opts, cb);
      }
    } else {
      return cb(null, false);
    }
  },
  /**
   * @param  {object} req
   * @param  {object} res
   * @param  {object} cb
   */
  getEnvironmentMode: function (req, res, cb) {
    // Use "FH_USE_LOCAL_DB" env var to determine if the app is running in local mode.
    if (process.env.FH_USE_LOCAL_DB) {
      // In local mode, if user provides function invoke it
      return cb(undefined, res);
    } else {
      //if it's not local mode, proxy the request back to millicore instead
      return call("admin/authpolicy/auth", req.body, cb);
    }
  }
}

module.exports = function (cfg) {
  config = cfg;
  call = require('./call')(config);
  session = require('./session')(config);
  return auth;
}
