var syncUtil = require('../sync-util');
var util = require('util');

var COLL_POSTFIX = '_collision';
var mongo;

module.exports = function (db) {

  if (!db) {
    throw new Error('MongoDB instance must be passed to module.');
  }
  mongo = db

  return {
    doList: function (dataset_id, params, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doList : ' + dataset_id +
                     ' :: query_params=' + util.inspect(params) +
                     ' :: meta_data=' + util.inspect(meta_data));
      mongo.collection(dataset_id).find(params).toArray(cb);
    },

    doCreate: function (dataset_id, data, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doCreate : ' + dataset_id + ' :: ' + util.inspect(data) +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).insertOne(data, cb);
    },

    doRead: function (dataset_id, uid, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doRead : ' + dataset_id +
                      ' :: ' + uid +
                      ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).findOne({"_id" : uid}, cb);
    },

    doUpdate: function (dataset_id, uid, data, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doUpdate : ' + dataset_id +
                     ' :: ' + uid + ' :: ' + util.inspect(data) +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).update({"_id" : uid}, data, cb);
    },

    doDelete: function (dataset_id, uid, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doDelete : ' + dataset_id +
                     ' :: ' + uid +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).remove({"_id" : uid}, cb);
    },

    handleCollision: function (dataset_id, meta_data, collisionFields, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doCollision : ' + dataset_id +
                     ' :: collisionFields=' + util.inspect(collisionFields) +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id + COLL_POSTFIX).insertOne(collisionFields, cb);
    },

    listCollisions: function (dataset_id, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'listCollisions : ' + dataset_id +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id + COLL_POSTFIX).find().toArray(cb);
    },

    removeCollision: function (dataset_id, uid, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'removeCollision : ' + dataset_id +
                     ' :: uid=' + uid +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id + COLL_POSTFIX).remove({"_id" : uid}, cb);
    }

  };

};
