var MongodbQueue = require('../lib/mongodbQueue');
var metrics = require('../lib/sync-metrics').init({}, null);
var async = require('async');
var assert = require('assert');
var helper = require('./helper');
var lockModule = require('../lib/lock');

var queueName = 'test_mongodb_queue';
var mongoDBUrl = 'mongodb://127.0.0.1:27017/' + queueName;

var mongodb;
var queue;
var lock;

module.exports = {
  'test mongodb queue': {
    'before': function(done) {
      helper.dropCollection(mongoDBUrl, queueName, function(err, db){
        if (err) {
          return done(err);
        }
        mongodb = db;
        lock = lockModule(mongodb);
        return done();
      });
    },

    'after': function(done) {
      done();
    },

    'test mongo queue add, get, search and prune': function(done) {
      queue = new MongodbQueue(queueName, metrics, lock, {mongodb: mongodb, messagesToKeep: {time: '1s'}, visibility: 1});
      var messageToAck;
      async.series([
        async.apply(queue.create.bind(queue)),
        async.apply(queue.addMany.bind(queue), [{id: '1'}]),
        function testGet(callback) {
          queue.get(function(err, message){
            assert.ok(!err);
            assert.ok(message);
            assert.equal(message.payload.id, '1');
            messageToAck = message;
            console.log('messageToAck', messageToAck);
            callback();
          });
        },
        function testAck(callback) {
          queue.ack(messageToAck.ack, callback);
        },
        async.apply(queue.addMany.bind(queue), [{id: '2'}]),
        function testSearch(callback) {
          queue.search({id: '2'}, function(err, messages){
            assert.ok(!err);
            assert.equal(1, messages.length);
            assert.equal(messages[0].id, '2');
            callback();
          });
        },
        function checkMessagesCount(callback) {
          var collection = mongodb.collection(queueName);
          collection.count({}, function(err, size){
            assert.ok(!err);
            assert.equal(2, size);
            callback();
          });
        }
      ], function(err){
        assert.ok(!err);
        done();
      });
    }
  }
}