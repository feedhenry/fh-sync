var assert = require('assert'),
  cache, config;
module.exports = function (cfg) {
  assert.ok(cfg, 'cfg is undefined');
  config = cfg;
  cache = require('./cache')(config);
  return session();
};


var session = function () {
  var errors = {},
    SESSION_PREPEND = "FHSERVER_SESSION",
    exceptions = {};

  errors.INVALID_SESSIONID = "invalid sessionId it must be a string";
  errors.INVALID_KEY = "invalid key it must be a string";
  errors.INVALID_DATA = "data must be a string";
  exceptions.INVALID_CALLBACK = {type: "InvalidCallbackException", message: "cb must be a function"};

  function prependSession(sessionId) {
    return SESSION_PREPEND + sessionId;
  }

  function set(sessionId, data, expire, cb) {
    if ('function' !== typeof cb) throw exceptions.INVALID_CALLBACK;
    if ('string' !== typeof sessionId) return cb(errors.INVALID_SESSIONID);
    if ('string' !== typeof data) return cb(errors.INVALID_DATA);
    var sessionid = prependSession(sessionId),
      action = {act: 'save', key: sessionid, value: data},
      expiry;
    if (expire !== 0) {
      expiry = Number(expire);
      if (expiry !== 0) action.expire = expiry;
    }
    cache(action, function (err) {
      if (err)return cb(err);
      return cb(undefined, sessionId);
    });
  }

  function get(sessionId, cb) {
    if ('function' !== typeof cb) throw exceptions.INVALID_CALLBACK;
    if ('string' !== typeof sessionId) return cb(errors.INVALID_SESSIONID);
    var internalSid = prependSession(sessionId);
    cache({act: 'load', key: internalSid}, function (err, data) {
      if (err) return cb(err);
      return cb(undefined, data);
    });
  }

  function remove(sessionId, cb) {
    if ('function' !== typeof cb) throw exceptions.INVALID_CALLBACK;
    if ('string' !== typeof sessionId) return cb(errors.INVALID_SESSIONID);
    var internalSid = prependSession(sessionId);
    cache({act: 'remove', key: internalSid}, function (err, suc) {
      if (err) return cb(err);
      return cb(undefined, suc);
    });
  }

  //api
  return {
    get: get,
    set: set,
    remove: remove
  };
};
//end session
