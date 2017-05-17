var assert = require('assert');
var async = require('async');
var helper = require('./helper');
var sync = require('../lib');

var MONGODB_URL = "mongodb://127.0.0.1:27017/test_interceptors";
var DATASETID = 'syncInterceptors';
var DATASETID2 = 'syncInterceptors2';
var TESTCUID = 'syncInterceptorsTestCuid';

module.exports = {
  'test interceptor overrides': {
    'before': function(done) {
      async.series([
        async.apply(helper.resetDb, MONGODB_URL, DATASETID),
        async.apply(sync.api.connect, MONGODB_URL, null, null)
      ], done);
    },
    'after': function(done) {
      sync.api.stopAll(done);
    },
    'test overrides': function(done) {
      sync.api.globalInterceptRequest(function(datasetId, params, callback){
        if (params.meta_data && params.meta_data.token === 'good') {
          return callback();
        } else {
          return callback(new Error('auth failed'));
        }
      });
      sync.api.interceptRequest(DATASETID2, function(datasetId, params, callback){
        if (params.meta_data && params.meta_data.token === 'bad') {
          return callback();
        } else {
          return callback(new Error('auth failed'));
        }
      });
      var params = {
        fn: 'sync',
        query_params: {user: '1'},
        meta_data: {token: 'bad'},
        __fh: {
          cuid: TESTCUID
        },
        pending: [{
          action: 'create',
          hash: 'a1',
          uid: 'client-a1',
          post: {
            'a': '1',
            'user': '1'
          }
        }]
      };
      async.series([
        function shouldFail(callback) {
          sync.api.invoke(DATASETID, params, function(err){
            assert.ok(err);
            assert.equal(err.message, 'auth failed');
            callback();
          });
        },
        function shouldWorkForAnotherDataset(callback) {
          sync.api.invoke(DATASETID2, params, function(err){
            assert.ok(!err);
            callback();
          });
        },
        function resetToken(callback) {
          params.meta_data.token = 'good';
          return callback();
        },
        function shouldWork(callback) {
           sync.api.invoke(DATASETID, params, function(err){
            assert.ok(!err);
            callback();
          });
        }
      ], done);
    }
  }
};