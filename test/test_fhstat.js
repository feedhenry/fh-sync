// Copyright (c) FeedHenry 2011
var util = require('util');
var async = require("async");
var assert = require('assert');
var fh;

exports.test_stats =  function(finish) {
  //var fhStats = fhs.stats({enabled:true});
  var i = 0;
  var counters = ['foo', 'bar', 'bob', 'alice', 'jack'];

  var fh = require("../lib/api.js");
  async.whilst(function() { return i<100;}, function(cb){
    var rand = Math.floor(Math.random() * counters.length);
    i++;

    // random counter inc
    fh.stats.inc(counters[rand], function(err, bytes){
    assert.ok(!err, 'Error: ' + err);
      // random counter dec
      rand = Math.floor(Math.random() * counters.length);
      fh.stats.dec(counters[rand], function(err, bytes){
        assert.ok(!err, 'Error: ' + err);
        // random timing
        rand = Math.floor(Math.random() * 101);
        fh.stats.timing("task1", rand, function(err, bytes){
          assert.ok(!err, 'Error: ' + err);
         cb();
        });
      });
    });

  }, function(err){
    assert.ok(!err, "Unexpected err: " + util.inspect(err));
    finish();
  });
}
