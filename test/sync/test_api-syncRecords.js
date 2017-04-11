var assert = require('assert');
var sinon = require('sinon');
var _ = require('underscore');
var syncRecordsModule = require('../../lib/sync/api-syncRecords');

var syncStorage = {
  readDatasetClientWithRecords: sinon.stub(),
  listUpdates: sinon.stub(),
  readDatasetClient: sinon.stub()
};

var pendingQueue = {
  search: sinon.stub()
};

module.exports = {
  'test syncRecords success': function(done) {
    var clientRecords = {
      '1': 'a',
      '2': 'b',
      '3': 'c',
      '4': 'd',
      '5-client': 'e'
    };

    var datasetClientsWithRecords = {
      syncCompleted: true,
      syncLoopEnd: Date.now() - 60*1000,
      globalHash: 'abcde',
      records: [{
        uid: '1',
        data: 'a1',
        hash: 'a1'
      }, {
        uid: '2',
        data: 'b',
        hash: 'b'
      }, {
        uid: '6',
        data: 'f',
        hash: 'f'
      }]
    };

    var appliedUpdates = [{
      uid: '5',
      oldUid: '5-client'
    }];

    var pendingChanges = [{
      uid: '4',
      pre: 'd',
      post: 'd4'
    }];

    syncStorage.readDatasetClient.yieldsAsync(null, {});
    syncStorage.readDatasetClientWithRecords.yieldsAsync(null, datasetClientsWithRecords);
    syncStorage.listUpdates.yieldsAsync(null, appliedUpdates);
    pendingQueue.search.yieldsAsync(null, pendingChanges);

    var syncRecords = syncRecordsModule(syncStorage, pendingQueue);
    var params = {
      clientRecs: clientRecords,
      _fh: {
        cuid: 'testcuid'
      }
    };

    syncRecords('testSyncRecordsDataset', params, function(err, response){
      assert.ok(!err);
      assert.ok(syncStorage.readDatasetClientWithRecords.calledOnce);
      assert.ok(syncStorage.listUpdates.calledOnce);
      assert.ok(pendingQueue.search.calledOnce);
      assert.equal(response.hash, datasetClientsWithRecords.globalHash);
      assert.equal(_.size(response.create), 1);
      assert.equal(_.keys(response.create)[0], '6');
      assert.equal(_.size(response.update), 1);
      assert.equal(_.keys(response.update)[0], '1');
      assert.equal(_.size(response.delete), 1);
      assert.equal(_.keys(response.delete)[0], '3');
      done();
    });
  },

  'test when sync loop not completed': function(done) {
    var datasetClientsWithRecords = {
      syncCompleted: false
    };

    var clientRecords = {};

    var syncRecords = syncRecordsModule(syncStorage, pendingQueue);
    var params = {
      clientRecs: clientRecords,
      _fh: {
        cuid: 'testcuid'
      }
    };

    syncStorage.readDatasetClient.yieldsAsync(null, {});
    syncStorage.readDatasetClientWithRecords.yieldsAsync(null, datasetClientsWithRecords);
    syncRecords('testSyncRecordsDataset', params, function(err, response){
      assert.ok(!err);
      done();
    });
  }
};