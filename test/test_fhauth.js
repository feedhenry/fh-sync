var authMock, $fh;
var assert = require('assert');
var _ = require('underscore')

module.exports = {
  setUp: function(finish){
    authMock = require('./fixtures/auth');
    $fh = require('../lib/api.js');
    finish();
  },

  testVerify: function(finish){
    var token = new Date().getTime();
    $fh.auth.verify(token, {expire: 60}, function(err, isValid){
      assert.ok(!err);
      assert.ok(isValid);
      finish();
    });
  },

  /**
   * @param  {object} finish
   */
  performAuthLocalDev : function(finish) {
    process.env.FH_USE_LOCAL_DB = 'true';

    var req = _.noop;
    var res = {body: 'test'};

    $fh.auth.performAuth(req, res, function(err, resp) {
      assert.notEqual(resp.body, 'productionMode');
      finish();
    });
  },
  
  /**
   * @param  {object} finish
   */
  performAuthProductionDev: function(finish) {
    process.env.FH_USE_LOCAL_DB = '';

    var req = {body: 'test'};
    var res = _.noop;

    $fh.auth.performAuth(req, res, function(err, resp) {
      assert.equal(resp.body, 'productionMode')
      finish();
    });
  },

  tearDown: function(finish){
    authMock.done();
    finish();
  }
}