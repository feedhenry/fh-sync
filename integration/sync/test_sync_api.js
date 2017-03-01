var sync = require('../../lib/sync');
var assert = require('assert');
var util = require('util');
var async = require('async');
var helper = require('./helper');

var mongoDBUrl = 'mongodb://127.0.0.1:27017';
var DATASETId = 'syncIntegrationTest';
var TESTCUID = 'syncIntegrationTestCuid';

module.exports = {
  'test sync api': {
    'before': function(done) {
      async.series([
        async.apply(helper.resetDb, mongoDBUrl, DATASETId),
        async.apply(helper.insertDocsToDb, mongoDBUrl, DATASETId, [{'b': '2'}, {'c': '3'}]),
        async.apply(sync.api.connect, mongoDBUrl, null, null)
      ], done);
    },
    'invoke sync': function(done) {
      var params = {
        fn: 'sync',
        query_params: {userId: '1'},
        meta_data: {token: 'testtoken'},
        _fh: {
          cuid: TESTCUID
        },
        pending: [{
          action: 'create',
          hash: 'a1',
          post: {
            uid: 'client-a1',
            hash: 'client-a1',
            data: {
              'a': '1'
            }
          }
        }]
      }
      async.series([
        function invokeSync(callback) {
          sync.api.invoke(DATASETId, params, function(err, response){
            assert.ok(!err);
            assert.ok(response);
            callback();
          });
        },
        function checkDataCreated(callback) {
          
        }
      ], function(err){

      });
      
    }
  }
}