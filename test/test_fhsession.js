//tests for fh.session
var util = require('util'),
$fh = require("../lib/api.js"),
async = require('async'),
session = JSON.stringify({
  "sessionId":"mysession"
});
var assert = require('assert');

module.exports = {

  "test session no timeout":function (finish) {

    $fh.session.set("mysession", session, 0, function (err, suc) {
      assert.ok(!err, 'Error: ' + err);
      assert.equal("mysession", suc);
      $fh.session.get("mysession", function (err, sess) {
        assert.ok(!err, 'Error: ' + err);
        assert.ok(sess);
        $fh.session.remove("mysession", function (err, suc) {
          assert.ok(!err, 'Error: ' + err);
          assert.equal(true,suc);
          finish();
        });
      });
    });
  },

  "test session with timeout":function (finish) {
    //set session to expire in 2 secs
    $fh.session.set("timeoutsession", session, 2, function (err, suc) {
      assert.ok(!err, 'Error: ' + err);
      assert.equal("timeoutsession", suc);
      $fh.session.get("timeoutsession", function (err, data) {
        assert.ok(!err, 'Error: ' + err);
        assert.ok(data);
        setTimeout(function () {
          $fh.session.get("timeoutsession", function (err, sess) {
            assert.ok(!err, 'Error: ' + err);
            assert.equal(null, sess);
            finish();
          });
        }, 4000);
      });
    });
  },

  "test retrieving cache from session":function (finish) {
    $fh.cache({act:'save', key:'testkey', value:'cheeky'}, function (err, data) {
      //stored value now try and retrieve through $fh.session
      if (err)console.log("error storing in cache");
      $fh.session.get('testkey', function (err, data) {
        assert.ok(!err, 'Error: ' + err);
        assert.equal(null, data);
        finish();
      });
    });
  },

  "test errors on bad params":function (finish) {
    try {
      $fh.session.get("mybadparam");
    } catch (e) {
      assert.equal("InvalidCallbackException", e.type);
      finish();
    }
  }
};