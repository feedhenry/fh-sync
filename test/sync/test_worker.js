var assert = require('assert');
var sinon = require('sinon');
var Worker = require('../../lib/sync/worker');

var processor = function(task, finish) {
  console.log("processing job", task);
  task.processed = true;
  setTimeout(finish, 0);
};

module.exports = {
  'test_queue_worker': function(done) {
    var q = {
      get: sinon.stub()
    };
    var task1 = {id: 1};
    var task2 = {id: 2};
    q.get.onFirstCall().yields(null, task1);
    q.get.onSecondCall().yields(new Error('test error'));
    q.get.onThirdCall().yields(null, null);
    q.get.onCall(3).yields(null, task2);
    var worker = new Worker(q, processor, {interval: 10});
    worker.work();
    setTimeout(function(){
      assert.ok(task1.processed);
      assert.ok(task2.processed);
      done();
    }, 50);
  }
};