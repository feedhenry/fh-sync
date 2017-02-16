var assert = require('assert');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var async = require('async');

module.exports = {
  'test mongodb queue methods': function(done) {
    var metrics = {gauge: function(){}};
    var MongodbQueue = require('../../lib/sync/mongodbQueue');
    var queue = new MongodbQueue('test', metrics, {mongodb: {}});
    ['create', 'add', 'get', 'ack', 'ping', 'total', 'size', 'inFlight', 'done', 'clean'].forEach(function(method){
      assert.equal(typeof queue[method], 'function');
    });
    done();
  },

  'test function wrappers': function(done) {
    var mockMongodbQueue = {
      createIndexes: function(cb) {
        return cb();
      }
    };
    var methods = ['add', 'get', 'ack', 'ping', 'total', 'size', 'inFlight', 'done', 'clean'];
    methods.forEach(function(method){
      var fn = sinon.stub();
      fn.yieldsAsync();
      mockMongodbQueue[method] = fn;
    });

    var MongodbQueue = proxyquire('../../lib/sync/mongodbQueue', {
      'mongodb-queue': function(){
        return mockMongodbQueue
      }
    });

    var metrics = {
      gauge: sinon.spy()
    };
    var queue = new MongodbQueue('test-metrics-queue', metrics, {mongodb: {}});
    queue.create(function(){
      async.parallel([
        async.apply(queue.add.bind(queue)),
        async.apply(queue.get.bind(queue)),
        async.apply(queue.ack.bind(queue)),
        async.apply(queue.ping.bind(queue)),
        async.apply(queue.total.bind(queue)),
        async.apply(queue.size.bind(queue)),
        async.apply(queue.inFlight.bind(queue)),
        async.apply(queue.done.bind(queue)),
        async.apply(queue.clean.bind(queue))
      ], function(err){
        assert.ok(!err);
        assert.equal(metrics.gauge.callCount, methods.length);
        methods.forEach(function(method){
          assert.ok(mockMongodbQueue[method].calledOnce);
        });
        done();
      });
    });
  }
};