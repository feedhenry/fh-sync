var authMock, $fh;
var assert = require('assert');

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

  tearDown: function(finish){
    authMock.done();
    finish();
  }
}