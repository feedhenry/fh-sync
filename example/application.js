var cluster = require('cluster');
var express = require('express');
var bodyParser = require('body-parser');
var mbaasApi = require('fh-mbaas-api');
var sync = require("fh-sync");
var mbaasExpress = mbaasApi.mbaasExpress();
var cpuCount = require('os').cpus().length;

if (cluster.isMaster && process.env.SHOULD_SCALE === 'true') {
  // Scale to defined number of workers, or just the amount of cores
  var clusterSize = process.env.WORKER_COUNT || cpuCount;

  for(var i = 0; i < clusterSize; i++) {
    console.log('Starting worker ' + (i + 1) + ' with CPU count of ' + cpuCount);
    cluster.fork(Object.assign({}, process.env, { metricsId: 'worker-' + (i + 1) }));
  }
} else {

  // Define custom sync handlers and interceptors
  require('./lib/sync.js');

  // Securable endpoints: list the endpoints which you want to make securable here
  var securableEndpoints = [];

  var app = express();

  // Note: the order which we add middleware to Express here is important!
  app.use('/sys', mbaasExpress.sys(securableEndpoints));
  app.use('/mbaas', mbaasExpress.mbaas);

  // Note: important that this is added just before your own Routes
  app.use(mbaasExpress.fhmiddleware());

  // Add extra routes here
  app.post('/collection/seed', bodyParser.json({limit: '100mb'}), require('./lib/collection').seed);
  app.post('/sync/all', bodyParser.json({ limit: '100mb' }), require('./lib/test').allSync);

  // Important that this is last!
  app.use(mbaasExpress.errorHandler());

  var port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
  var host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
  var server = app.listen(port, host, function() {
    console.log("App started at: " + new Date() + " on port: " + port); 
  });
}
