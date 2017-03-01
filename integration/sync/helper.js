var MongoClient = require('mongodb').MongoClient;
var storageModule = require('../../lib/sync/storage');

/**
 * 
 * Helper function to remove all the sync related data from the given db.
 * @param {String} dburl 
 * @param {String} datasetId 
 * @param {Function} cb 
 */
function resetDb(dburl, datasetId, cb){
  var DATASETCLIENTS_COLLECTION = storageModule.DATASETCLIENTS_COLLECTION;
  var RECORDS_COLLECTION = storageModule.getDatasetRecordsCollectionName(datasetId);
  var UPDATES_COLLECTION = storageModule.getDatasetUpdatesCollectionName(datasetId);

  MongoClient.connect(dburl, function(err, db){
    if (err) {
      console.log('mongodb connection error', err);
      return done(err);
    }
    async.each([DATASETCLIENTS_COLLECTION, RECORDS_COLLECTION, UPDATES_COLLECTION, datasetId], function(collection, cb){
      mongodb.dropCollection(collection, function(err){
        if (err && err.message === 'ns not found'){
          return cb();
        } else {
          return cb(err);
        }
      });
    }, function(err){
      if (err) {
        console.log('failed to drop collection', err);
      }
      cb(err, db);
    });
  });
}

/**
 * Helper function to insert some documents to the given db and collection
 * @param {String} dburl 
 * @param {String} collectionName 
 * @param {Array} docs 
 * @param {Function} cb 
 */
function insertDocsToDb(dburl, collectionName, docs, cb) {
  MongoClient.connect(dburl, function(err, db){
    if (err) {
      return cb(err);
    }
    var col = db.collection(collectionName);
    col.insertMany(docs, function(err, result){
      if (err) {
        return cb(err);
      }
      return cb();
    });
  });
}

module.exports = {
  resetDb: resetDb,
  insertDocsToDb: insertDocsToDb
};