var sync = require('../lib');

var mongodbConnectionString = 'mongodb://127.0.0.1:27017/sync';
var redisUrl = 'redis://127.0.0.1:6379';

sync.api.connect(mongodbConnectionString, {}, redisUrl, function(){});

sync.api.getEventEmitter().on('sync:ready', function() {
  console.log('sync ready');

  sync.api.init('myDataset', {
    syncFrequency: 10 // seconds
  }, function() {});
});