var MongodbQueue = require('../../lib/sync/mongodbQueue');
var assert = require('assert');

module.exports = {
  'test mongodb queue methods': function(done) {
    var queue = new MongodbQueue('test', {mongodb: {}});
    ['create', 'add', 'get', 'ack', 'ping', 'total', 'size', 'inFlight', 'done', 'clean'].forEach(function(method){
      assert.equal(typeof queue[method], 'function');
    });
    done();
  }
};