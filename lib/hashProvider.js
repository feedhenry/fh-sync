var syncUtil = require('./util');

/**
 * Store for the overridden hashing functions for each dataset.
 */
var overrides = {
  record: {},
  global: {}
}

/**
 * Set the default hashing algorithm.
 */
var defaultHashFn = syncUtil.generateHash;

/**
 * Invoke the datasets record hash function on a record
 * @param {String} datasetId the id of the dataset
 * @param {Object} record record in the dataset to hash
 * @returns {String} the resulting record hash
 */
function recordHash(datasetId, record) {
  return getRecordHashFn(datasetId)(record);
}

/**
 * Invoke the datasets global hash function on an array of hashes
 * @param {String} datasetId the id of the dataset
 * @param {String[]} hashes array of record hashes in the dataset
 * @returns {String} the resulting global hash
 */
function globalHash(datasetId, hashes) {
  return getGlobalHashFn(datasetId)(hashes);
}

/**
 * Set the current record hash function for the dataset.
 * @param {String} datasetId the id of the dataset
 * @param {Function} hashFn the function to override
 */
function setRecordHashFn(datasetId, hashFn) {
  overrides.record[datasetId] = hashFn;
}

/**
 * Set the current global hash function for the dataset.
 * @param {String} datasetId the id of the dataset
 * @param {Function} hashFn the function to override
 */
function setGlobalHashFn(datasetId, hashFn) {
  overrides.global[datasetId] = hashFn;
}

/**
 * Get the current record hash function for the dataset
 * @param {String} datasetId the id of the dataset
 * @returns {String} the resulting hash
 * @returns {Function} the record hashing function for the specified dataset
 */
function getRecordHashFn(datasetId) {
  return overrides.record[datasetId] || defaultHashFn;
}

/**
 * Get the current global hash function for the dataset
 * @param {String} datasetId the id of the dataset
 * @returns {Function} the global hashing function for the specified dataset
 */
function getGlobalHashFn(datasetId) {
  return overrides.global[datasetId] || defaultHashFn;
}

/**
 * Get the default hashing function for sync
 * @returns {Function} the default hashing function
 */
function getDefaultHashFn() {
  return defaultHashFn;
}

function restore() {
  overrides = {
    record: {},
    global: {}
  };
}

module.exports = {
  restore: restore,
  recordHash: recordHash,
  globalHash: globalHash,
  getRecordHashFn: getRecordHashFn,
  setRecordHashFn: setRecordHashFn,
  getGlobalHashFn: getGlobalHashFn,
  setGlobalHashFn: setGlobalHashFn,
  getDefaultHashFn: getDefaultHashFn
};