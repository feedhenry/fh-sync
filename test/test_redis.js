// Copyright (c) FeedHenry 2011

var util = require('util');
var async = require('async');
var $fh = require("../lib/api.js");
var assert = require('assert');

module.exports = {

  'test caching in fh': function(finish) {
    var d1, d2;
    getTime({}, function(err, data){
      d1 = data;
      assert.ok(!err, 'Error: ' + err);
      assert.ok(d1!==null);
      getTime({}, function(err, data){
        d2 = data;
        assert.ok(!err, 'Error: ' + err);
        assert.ok(data !== null);
        assert.equal(d1, d2);
        clearTime({}, function(err, data){
          assert.ok(!err, 'Error: ' + err);
          assert.notEqual(data, null);
          finish();
        });
      });
    });
  },
  'test $fh.cache with expire' : function(finish){
    var stringToExpire = "123";
    $fh.cache({act : 'save', key : 'expires', value : stringToExpire, expire : 1}, function(err, res){
      assert.ok(!err, 'Error: ' + err);
      $fh.cache({act : 'load', key : 'expires'}, function(err, unexpiredres){
        assert.ok(!err, 'Error: ' + err);
        assert.ok(unexpiredres === stringToExpire);
        setTimeout(function(){
          $fh.cache({act : 'load', key : 'expires'}, function(err, expiredred){
            assert.ok(!err, 'Error: ' + err);
            assert.ok(!expiredred, 'Expected no res, res is: ' + expiredred);
            finish();
          });
        }, 4000); // this has to be quite high on linux - no idea why, but takes some time to expire..
      });
    });
  }
};

function getTime(params, callback){
  $fh.cache({act:'load', key: 'time'}, function (err, cachedTime) {
    if (err) return callback(err, null);
    var currentTime = Date.now();

    if (cachedTime == null || (parseInt(cachedTime) + 10000) < currentTime) {
      $fh.cache({act: 'save', key: 'time', value: JSON.stringify(currentTime)}, function (err) {
        return callback(err, new Date(currentTime).toString());
      });
    }else
      return callback(null, new Date(parseInt(cachedTime)).toString());
  });
}

function clearTime(params, callback) {
  $fh.cache({act:'remove', key: 'time'}, function (err, data) {
    return callback(err, data);
  });
};