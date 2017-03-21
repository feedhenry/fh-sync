var sinon = require('sinon');
var assert = require('assert');

var syncModule = require('../../lib/sync/sync-metrics');
var namespace = 'fhsyncstats';
var tagValues = ['tag1', 'tag2', 'tag3'];

function generateValueData(size, tagName) {
  var dataArr = [];
  for (var i =0; i <= size -1; i++) {
    var data = {fields: {value: Math.floor(Math.random() * 1e5)}, ts: Date.now() - Math.floor(Math.random() * 1e5)};
    data.tags = {};
    data.tags[tagName] = tagValues[i%tagValues.length];
    dataArr.push(JSON.stringify(data));
  }
  return dataArr;
}

var redisClient = {
  lrange: function(keyName, start, end, cb) {
    if (keyName.indexOf(syncModule.KEYS.WORKER_JOB_PROCESS_TIME) > -1) {
      return cb(null, generateValueData(100, 'name'));
    }
    if (keyName.indexOf(syncModule.KEYS.SYNC_API_PROCESS_TIME) > -1) {
      return cb(null, generateValueData(100, 'fn'));
    }
    return cb();
  }
};


module.exports = {
  'test sync metrics': {
    'test getStatus': function(done) {
      syncModule.init({collectStats: true}, redisClient);
      syncModule.getStats(function(err, stats){
        assert.ok(!err);
        assert.ok(stats);
        assert.ok(stats['CPU usage (%)']);
        assert.ok(stats['CPU usage (%)']['message']);
        assert.ok(stats['RSS Memory Usage (byte)']);
        assert.ok(stats['RSS Memory Usage (byte)']['message']);
        assert.ok(stats['Job Queue Size']);
        assert.ok(stats['Job Queue Size']['message']);
        assert.ok(stats['Mongodb Operation Time (ms)']);
        assert.ok(stats['Mongodb Operation Time (ms)']['message']);
        assert.ok(stats['Job Process Time (ms)']);
        assert.ok(stats['Job Process Time (ms)']['tag1']);
        assert.ok(stats['Job Process Time (ms)']['tag2']);
        assert.ok(stats['Job Process Time (ms)']['tag3']);
        assert.ok(stats['API Process Time (ms)']);
        assert.ok(stats['API Process Time (ms)']['tag1']);
        assert.ok(stats['API Process Time (ms)']['tag2']);
        assert.ok(stats['API Process Time (ms)']['tag3']);
        assert.equal(typeof stats['Job Process Time (ms)']['tag1']['current'], 'number');
        assert.equal(typeof stats['API Process Time (ms)']['tag1']['current'], 'number');
        done();
      });
    }
  }
}