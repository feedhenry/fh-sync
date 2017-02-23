var assert = require('assert');
var hashProvider = require('../../lib/sync/hashProvider');

var defaultHashFn = hashProvider.getDefaultHashFn();

var testRecord = { test: 'test' };
var testRecordDefaultHash = '2cf4bac104e148d1541885ddd9cec7ab530f4ccf';
var testHashes = ['test', 'sync', 'hash'];

var notOverriddenDataset = 'not_overridden';
var overriddenDataset = 'overridden';

function recordHashOverride(record) {
  return record;
}

function globalHashOverride(hashes) {
  return hashes.join('');
}

module.exports = {
  'test default record hash provider': function() {
    var hashFn = hashProvider.getRecordHashFn(overriddenDataset);
    assert.equal(hashFn, defaultHashFn);

    var hash = hashProvider.recordHash(notOverriddenDataset, testRecord);
    assert.equal(hash, testRecordDefaultHash);
  },

  'test default global hash provider': function() {
    var hashFn = hashProvider.getRecordHashFn(overriddenDataset);
    assert.equal(hashFn, defaultHashFn);

    var hash = hashProvider.globalHash(notOverriddenDataset, testRecord);
    assert.equal(hash, testRecordDefaultHash);
  },

  'test overridden record hash provider': function() {
    hashProvider.setRecordHashFn(overriddenDataset, recordHashOverride);
    var hashFn = hashProvider.getRecordHashFn(overriddenDataset);
    assert.equal(hashFn, recordHashOverride);

    var hash = hashProvider.recordHash(overriddenDataset, testRecord);
    assert.equal(hash, testRecord);
  },

  'test overridden global hash provider': function() {
    hashProvider.setGlobalHashFn(overriddenDataset, globalHashOverride);
    var hashFn = hashProvider.getGlobalHashFn(overriddenDataset);
    assert.equal(hashFn, globalHashOverride);

    var hash = hashProvider.globalHash(overriddenDataset, testHashes);
    var expectedHash = globalHashOverride(testHashes);
    assert.equal(hash, expectedHash);
  }
};