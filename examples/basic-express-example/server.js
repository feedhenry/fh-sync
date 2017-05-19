var sync = require('fh-sync');

var express = require('express')
var app = express()

app.get('/', function (req, res) {
  res.send('Sample application!')
})

/** Mount sync api */
app.post('/sync/:datasetId', function (req, res) {
  var dataset_id = req.params.datasetId;
  var params = req.body;

  sync.invoke(dataset_id, params, function (err, ok) {
    return endResponseCallback(req, res, err, ok);
  });
});

var datalistHandler = function (dataset_id, query_params, cb, meta_data) {
  var data = {
    '00001': {
      'item': 'item1'
    },
    '00002': {
      'item': 'item2'
    },
    '00003': {
      'item': 'item3'
    }
  }
  return cb(null, data);
}


// Sync framework initialization
var mongodbConnectionString = 'mongodb://127.0.0.1:27017/sync';
var redisUrl = 'redis://127.0.0.1:6379';

sync.api.connect(mongodbConnectionString, {}, redisUrl, function () { });
sync.api.getEventEmitter().on('sync:ready', function () {
  console.log('sync ready');
  var options = {
    syncFrequency: 10 // seconds
  };
  var datasetId = "dataset-name";
  console.log("Init sync data handlers for dataset");
  sync.api.init(datasetId, options, function (err) {
    if (err) {
      console.error(err);
    } else {
      sync.api.handleList(datasetId, datalistHandler);
    }
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})