var sinon = require('sinon');
var assert = require('assert');

var datasetClientsCleanerModule = require('../../lib/sync/datasetClientsCleaner');

var datasetClientCleaner;

var syncStorage = {
  listDatasetClients: sinon.stub(),
  removeDatasetClients: sinon.stub()
};

var DATASETID = 'testDatasetClientsCleaner';

module.exports = {
  'test datasetClientsCleaner': {
    'before': function(done) {
      syncStorage.listDatasetClients.reset();
      syncStorage.removeDatasetClients.reset();
      datasetClientCleaner = datasetClientsCleanerModule(syncStorage)({retentionPeriod: '1m', checkFrequency: '100ms'});
      done();
    },
    'after': function(done) {
      if (datasetClientCleaner) {
        datasetClientCleaner.stop();
      }
      return done();
    },
    'test datasetClientCleaner success': function(done) {
      var datasetClients = [{
        'datasetId': DATASETID,
        'queryParams': {user: '1'},
        'lastAccessed': Date.now() - 1.5*60*1000
      }, {
        'datasetId': DATASETID,
        'queryParams': {user: '2'},
        'lastAccessed': Date.now()
      }];
      syncStorage.listDatasetClients.yieldsAsync(null, datasetClients);
      syncStorage.removeDatasetClients.yieldsAsync(null, {});
      datasetClientCleaner.start(true);
      setTimeout(function(){
        assert.ok(syncStorage.listDatasetClients.called);
        assert.ok(syncStorage.removeDatasetClients.called);
        var datasetClientsToRemove = syncStorage.removeDatasetClients.args[0][0];
        assert.equal(datasetClientsToRemove.length, 1);
        assert.equal(datasetClientsToRemove[0].queryParams.user, '1');
        done();
      }, 120);
    },
    'test datasetClientCleaner with no dataset clients': function(done) {
      var datasetClients = [];
      syncStorage.listDatasetClients.yieldsAsync(null, datasetClients);
      syncStorage.removeDatasetClients.yieldsAsync(null, {});
      datasetClientCleaner.start(true);
      setTimeout(function(){
        assert.ok(syncStorage.listDatasetClients.called);
        assert.ok(syncStorage.removeDatasetClients.called);
        done();
      }, 120);
    }
  }
}

