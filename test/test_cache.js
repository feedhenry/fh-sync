var proxyquire = require('proxyquire').noCallThru();

var util = require('util');
var async = require('async');
var assert = require('assert');
var sinon = require('sinon');

var mockCfg = {
  logger: null,
  fhapi: {
    appname: 'testapp'
  },
  redis: {
    host: 'redishost',
    port: '1234',
    password: 'mysecret'
  }
};

var mockRedis = {
  createClient: sinon.spy(function(testPort, testHost) {
    // check that we're trying to connect with the configured host/port params
    assert.equal(parseInt(mockCfg.redis.port), testPort);
    assert.equal(mockCfg.redis.host, testHost);
    return {
      on: function(event, cb) {
        if (event === 'ready') {
          process.nextTick(function() {
            cb(null);
          });
        }
      },
      auth: function(pass) {
        assert.equal(mockCfg.redis.password, pass);
      },
      get: function(key, cb) {
        return cb(null, 'cacheval1');
      },
      setex: function(key, expire, value, cb) {
        return cb(null, 'OK');
      },
      set: function(key, value, cb) {
        return cb(null, 'OK');
      },
      del: function(key, cb) {
        return cb(null, 1);
      },
      quit: function() {},
      end: function() {}
    };
  })
};

var mockMemcached = sinon.spy(function() {
  this.get = function(key, cb) {
    return cb(null, 'cacheval1');
  };
  this.set = function(key, value, expiry, cb) {
    return cb();
  };
  this.del = function(key, cb) {
    return cb();
  };
});

module.exports = {
  'test redis save load remove': function(finish) {
    process.env.JDG_SERVICE_PORT = '';
    process.env.JDG_SERVICE_HOSTNAME = '';
    var cache = proxyquire('../lib/cache.js', {'redis' : mockRedis}) (mockCfg);

    cache({
      act: 'save',
      key: 'cachetest1',
      value: 'cacheval1'
    }, function(err, res) {
      assert.equal(res, 'OK');
      sinon.assert.calledOnce(mockRedis.createClient);
      cache({
        act: 'load',
        key: 'cachetest1'
      }, function(err, res) {
        sinon.assert.calledTwice(mockRedis.createClient);
        assert.equal(res, 'cacheval1');
        cache({
          act: 'remove',
          key: 'cachetest1'
        }, function(err, res) {
          sinon.assert.calledThrice(mockRedis.createClient);
          assert(err == null);
          return finish();
        });
      });
    });
  },

  'test jdg save load remove': function(finish) {
    process.env.JDG_SERVICE_PORT = '11211';
    process.env.JDG_SERVICE_HOSTNAME = '192.168.99.100';

    var cache = proxyquire('../lib/cache.js', {'memcached' : mockMemcached})(mockCfg);
    sinon.assert.calledOnce(mockMemcached);
    sinon.assert.calledWith(mockMemcached, process.env.JDG_SERVICE_HOSTNAME + ':' + process.env.JDG_SERVICE_PORT);

    cache({
      act: 'save',
      key: 'cachetest1',
      value: 'cacheval1',
      expire: 10
    }, function(err, res) {
      assert.equal(err, null);
      assert.equal(res, 'OK');
      cache({
        act: 'load',
        key: 'cachetest1'
      }, function(err, res) {
        assert.equal(res, 'cacheval1');
        cache({
          act: 'remove',
          key: 'cachetest1'
        }, function(err, res) {
          assert(err == null);
          return finish();
        });
      });
    });
  }
};
