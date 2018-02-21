var assert = require('assert');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var async = require('async');

var mockLock = {
  acquire: sinon.stub(),
  release: sinon.stub()
};

module.exports = {
  'test mongodb queue methods': function(done) {
    var metrics = {gauge: function(){}};
    var MongodbQueue = require('../lib/mongodbQueue');
    var queue = new MongodbQueue('test', metrics, mockLock, {mongodb: {}});
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
    var mockMongodb = {
      collection: function() {
        return {
          dropIndex: function(name, cb) {
            return cb();
          },
          createIndex: function(name, opts, cb) {
            return cb();
          },
          indexExists: function(name, cb) {
            return cb();
          },
          indexInformation: function(opts, cb) {
            return cb(null, []);
          }
        }
      }
    }
    var methods = ['add', 'get', 'ack', 'ping', 'total', 'size', 'inFlight', 'done', 'clean'];
    methods.forEach(function(method){
      var fn = sinon.stub();
      fn.yieldsAsync();
      mockMongodbQueue[method] = fn;
    });

    var MongodbQueue = proxyquire('../lib/mongodbQueue', {
      'fh-mongodb-queue': function(){
        return mockMongodbQueue
      }
    });

    var metrics = {
      gauge: sinon.spy()
    };
    mockLock.acquire.yieldsAsync(null, 'testlock');
    mockLock.acquire.yieldsAsync();
    
    var queue = new MongodbQueue('test-metrics-queue', metrics, mockLock, {mongodb: mockMongodb});
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
