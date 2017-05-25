var sync = require('fh-sync');

var express = require('express')
var app = express()

// Sync framework requires mongodb and redis to be running
var mongodbConnectionString = process.env.MONGO_CONNECTION_URL || 'mongodb://127.0.0.1:27017/sync';
var redisUrl = process.env.REDIS_CONNECTION_URL || 'redis://127.0.0.1:6379';

// Following example will sync for single domain object
// called messages
var datasetId = "messages";

app.get('/', function (req, res) {
  res.send('Sample application is running!')
})

/** 
 * Sync express api required for sync clients
 * All sync clients will call that endpoint to sync data
 */
app.post('/sync/:datasetId', function (req, res) {
  var dataset_id = req.params.datasetId;
  var params = req.body;
  
  // Invoke action in sync for specific dataset
  sync.api.invoke(dataset_id, params, function (err, result) {
    if (err) {
      res.status(500).json(err);
      return;
    }
    return res.json(result)
  });
});

var mongoOptions = {};
// Initialize sync to connect to mongodb and redis
sync.api.connect(mongodbConnectionString, mongoOptions, redisUrl, function (err) {
  if (err) {
    console.log('Problem with initializing sync', err);
  } else {
    console.log('Sync initialized');
    activateForDataset(datasetId);
  }
});

/**
 * This function with create new sync dataset and seed initial data
 */
function activateForDataset(datasetId) {
  // See documentation for more options
  var options = {
    syncFrequency: 10 // seconds
  };
  console.log("Init sync data handlers for dataset");
  sync.api.init(datasetId, options, function (err) {
    if (err) {
      console.error(err);
    } else {
      var dataHandler = require("./lib/dataAccessLayer");
      // List is just one of the CRUD operations that sync supports.
      // See documentation for more options.
      // If not defined data will be handled by mongodb driver.
      sync.api.handleList(datasetId, dataHandler.list);
    }
  });
}

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})