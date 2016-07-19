// Copyright (c) FeedHenry 2011

var util = require('util'),
actMock, fhs, fhsConfig, $fh;
var async = require('async');
var assert = require('assert');
var validUrl = require('valid-url');
var nock = require('nock');
var sinon = require('sinon');


var request = function (opts,callback){
  assert.ok(validUrl.isUri(opts.url),"expected a valid url: " + util.inspect(opts.url));
  callback(null, {}, 'ok');
};

var cache = function (cfg){
  return function (opts,cb){
    return cb();
  };
};

var call = function () {
  return function (url, opts, callback) {
    callback(null, {
      status: 200,
      body: JSON.stringify({
        hosts: {
          url: 'https://test.feedhenry.com'
        }
      })
    });
  };
};

var act = require('proxyquire')('../lib/act.js', {
  'request': request,
  './cache': cache,
  './call': call
})({
  fhapi: {}
});


module.exports = {
  setUp : function(finish){

    actMock = nock('https://localhost:443')
      .filteringRequestBody(function(path) {
        return '*';
      }).post('/box/srv/1.1/sys/info/ping', '*')
      .reply(200, {ok:true});


    $fh = require("../lib/api.js");
    finish();
  },
  'test act $fh.act url formatting must add leading slash': function (finish) {

    act({
      guid: '123456789erghjtrudkirejr',
      path: 'user/feedhenry'
    }, function (err, body, res) {
      assert.equal(err, null);
      assert.equal(body, 'ok');
      finish();
    });
  },
  'test dev $fh.act': function(finish) {

    act({
      guid: "123456789erghjtrudkirejr",
      endpoint: "doSomething",
      params: {
        somekey: "someval"
      }
    }, function(err, data) {
      assert.ok(!err, 'Error: ' + err);
      assert.ok(data);
      finish();
    });
  },
  'test live $fh.act': function(finish) {
    act({
      guid: "123456789erghjtrudkirejr",
      endpoint: "doSomething",
      params: {
        somekey: "someval"
      },
      live : true
    }, function(err, data) {
      assert.ok(!err, 'Error: ' + err);
      assert.ok(data);
      finish();
    });
  },
  'test $fh.act bad args': function(finish) {
    var gotException = false;
    try {
      $fh.act({});
    } catch (x) {
      gotException = true;
    }
    assert.equal(gotException, true);
    finish();
  },
  'test $fh.call sys info ping' : function(finish){
    $fh.call('sys/info/ping', {}, function(err, res){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(res.status === 200);
      assert.ok(JSON.parse(res.body).ok === true);
      finish();
    });
  },
  'test $fh.act sets and gets cache': function (finish){
    var cacheStub = sinon.stub();
    var mocks = {
      'request': request,
      './cache': function (opts){
        return cacheStub;
      },
      './call':call
    };
    var act = require('proxyquire')('../lib/act.js',mocks)({
      fhapi: {}
    });
    //call the stub callback
    cacheStub.callsArgWith(1);
    act({
      guid: "123456789erghjtrudkirejr",
      endpoint: "doSomething",
      params: {
        somekey: "someval"
      }
    }, function(err, data) {
      assert.ok(!err, 'Error: ' + err);
      assert.ok(data);
      assert.ok(cacheStub.calledTwice,"expected cache to be called twice. Once for get and once for set");
      sinon.assert.calledWith(cacheStub, {"act":"load","key":"123456789erghjtrudkirejr-dev"});
      sinon.assert.calledWith(cacheStub, {"act":"save","key":"123456789erghjtrudkirejr-dev","value":"https://test.feedhenry.com","expire":300});
      finish();
    });

  },
  'test $fh.act sets qs params for method of "GET"/"get"': function (finish) {
    var requestStub = function (opts, callback) {
      assert(opts.qs);
      assert.equal(opts.qs.name, 'fh.act');

      callback(null, null);
    };

    var getAct = require('proxyquire')('../lib/act.js', {
      'request': requestStub,
      './cache': cache,
      './call': call
    })({
      fhapi: {}
    });

    // Assertions should pass for both 'GET' and 'get'
    async.each(['get', 'GET'], function (mtd, next) {
      getAct({
        guid: "123456789erghjtrudkirejr",
        endpoint: "/fake/endpoint",
        method: mtd,
        params: {
          name: "fh.act"
        }
      }, next);
    }, function (err) {
      assert.equal(err, null || undefined);
      finish();
    });
  },
  tearDown : function(finish){
    actMock.done();
    finish();
  }
};
