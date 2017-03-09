var syncUtil = require('./util');
var util = require('util');
var ObjectID = require('mongodb').ObjectID;

var mongo;

function convertToObjectId(datasetId, originalId) {
  var newObjectId = originalId;
  if (ObjectID.isValid(originalId)) {
    newObjectId = ObjectID(originalId);
  } else {
    syncUtil.doLog(datasetId, 'warn', 'Invalid objectId value : ' + originalId);
  }
  return newObjectId;
}

module.exports = function (db) {

  if (!db) {
    throw new Error('MongoDB instance must be passed to module.');
  }
  mongo = db

  return {
    doList: function (dataset_id, params, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'debug',
                     'doList : ' + dataset_id +
                     ' :: query_params=' + util.inspect(params) +
                     ' :: meta_data=' + util.inspect(meta_data));
      mongo.collection(dataset_id).find(params).toArray(function (err, array) {
        if (err) {
          return cb(err);
        }
        cb(null, toObject(array));
      });
    },

    doCreate: function (dataset_id, data, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'debug',
                     'doCreate : ' + dataset_id + ' :: ' + util.inspect(data) +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).insertOne(data, function(err, res) {
        if (err) {
          return cb(err);
        }
        syncUtil.doLog(dataset_id, 'debug', 'doCreate done : ' + util.inspect(res));
        cb(null, makeResponse(res.ops[0]));
      });
    },

    doRead: function (dataset_id, uid, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doRead : ' + dataset_id +
                      ' :: ' + uid +
                      ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).findOne({"_id" : convertToObjectId(dataset_id, uid)}, function(err, found){
        if (err) {
          return cb(err);
        }
        if (found) {
          delete found._id; //do not return _id field as part of the object
        }
        return cb(null, found);
      });
    },

    doUpdate: function (dataset_id, uid, data, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doUpdate : ' + dataset_id +
                     ' :: ' + uid + ' :: ' + util.inspect(data) +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).updateOne({"_id" : convertToObjectId(dataset_id, uid)}, data, cb);
    },

    doDelete: function (dataset_id, uid, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doDelete : ' + dataset_id +
                     ' :: ' + uid +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(dataset_id).remove({"_id" : convertToObjectId(dataset_id, uid)}, cb);
    },

    handleCollision: function (dataset_id, meta_data, collisionFields, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'doCollision : ' + dataset_id +
                     ' :: collisionFields=' + util.inspect(collisionFields) +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(collisionCollection(dataset_id)).insertOne(collisionFields, function(err, res) {
        if (err) {
          return cb(err);
        }
        cb(null, makeResponse(res.ops[0]));
      });
    },

    listCollisions: function (dataset_id, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'listCollisions : ' + dataset_id +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(collisionCollection(dataset_id)).find().toArray(function (err, array) {
        if (err) {
          return cb(err);
        }
        cb(null, toObject(array));
      });
    },

    removeCollision: function (dataset_id, hash, meta_data, cb) {
      syncUtil.doLog(dataset_id, 'verbose',
                     'removeCollision : ' + dataset_id +
                     ' :: hash=' + hash +
                     ' :: meta=' + util.inspect(meta_data));
      mongo.collection(collisionCollection(dataset_id)).remove({hash : hash}, cb);
    }

  };

};

function toObject(array) {
  var data = {};
  array.forEach(function extractUidAndData(value) {
    var uid = value._id.toString();
    delete value._id;
    data[uid] = value;
  });
  return data;
}


function makeResponse(res) {
  var data = {
    uid: res._id.toString(),
    data: res
  };
  delete res._id;
  return data;
}

function collisionCollection(dataset_id) {
  return dataset_id + '_collision';
}
