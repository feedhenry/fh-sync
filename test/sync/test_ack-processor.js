var assert = require('assert');
var sinon = require('sinon');
var ackProcessorModule = require('../../lib/sync/ack-processor');

var syncStorage = {
  findAndDeleteUpdate: sinon.stub()
};

module.exports = {
  'test process ack missing args': function(done) {
    var ackRequest = {
      payload: {
        datasetId: 'testDataset'
      }
    };

    syncStorage.findAndDeleteUpdate.yieldsAsync();
    var ackProcessor = ackProcessorModule(syncStorage);
    ackProcessor(ackRequest, function(err){
      assert.ok(!err);
      assert.equal(syncStorage.findAndDeleteUpdate.callCount, 0);
      done();
    });
  },

  'test process ack success': function(done) {
    var ackRequest = {
      payload: {
        datasetId: 'testDataset',
        cuid: 'testCuid',
        hash: 'testHash'
      }
    };

    syncStorage.findAndDeleteUpdate.yieldsAsync();
    var ackProcessor = ackProcessorModule(syncStorage);
    ackProcessor(ackRequest, function(err){
      assert.ok(!err);
      assert.ok(syncStorage.findAndDeleteUpdate.calledOnce);
      done();
    });
  }
}