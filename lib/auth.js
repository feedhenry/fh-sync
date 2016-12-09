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
   * New endpoint required as autentication ($fh.auth) requests not handled
   * correctly in local development/Studio Preview -
   * the js sdk dertermines envrironment mode from url string.
   * New endpoint determines environment mode from env var,
   * optionally sends request (localAuth - for local dev)
   * and calls user provided function (cb).
   * @param  {object} req
   * @param  {function} localAuth - optional for local development.
   * @param  {object} cb
   */
  performAuth: function (req, localAuth, cb) {
    // "FH_USE_LOCAL_DB" env var determines if the app is running in local mode.
    if (process.env.FH_USE_LOCAL_DB) {
      // In local mode, invoke user function/object
      if (_.isFunction(localAuth)) {
        return localAuth(req, cb);
      } else if (_.isObject(localAuth)) {
        return cb(undefined, localAuth);
      } else {
        return cb(undefined, {status: 200, body: {}});
      }
    } else {
            // In production mode, proxy request back to Core platform.
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
