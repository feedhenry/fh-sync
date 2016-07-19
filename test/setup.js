var proxyquire =  require('proxyquire').noCallThru(),
exec = require('child_process').exec,
redis;

exports.before = function(finish){
  require('./fixtures/env.js');

  // Start redis & mongo , wait 'till finished then run tests!
  redis = exec("redis-server", function(){});
  finish();
};

exports.after = function(finish){
  redis.kill();
  var fh = require("../lib/api.js");
  fh.sync.stopAll(function(err) {
    return finish();
  });
};