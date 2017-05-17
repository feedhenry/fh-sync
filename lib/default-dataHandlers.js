var syncUtil = require('./util');
var debug = syncUtil.debug;
var ObjectID = require('mongodb').ObjectID;

var mongo;

function convertToObjectId(datasetId, originalId) {
  var newObjectId = originalId;
  if (ObjectID.isValid(originalId)) {
    newObjectId = ObjectID(originalId);
  } else {
    debug('[%s] Invalid objectId value : %s', datasetId, originalId);
  }
  return newObjectId;
}

module.exports = function() {
  return {
    setMongoDB: function(db) {
      mongo = db;
    },

    doList: function(dataset_id, params, meta_data, cb) {
      debug(
        '[%s] doList :: query_params=%j :: meta_data=%j', dataset_id, params, meta_data);
      mongo.collection(dataset_id).find(params).toArray(function(err, array) {
        if (err) {
          return cb(err);
        }
        cb(null, toObject(array));
      });
    },

    doCreate: function(dataset_id, data, meta_data, cb) {
      debug(
        '[%s] doCreate :: %j :: meta=%j', dataset_id, data, meta_data);
      mongo.collection(dataset_id).insertOne(data, function(err, res) {
        if (err) {
          return cb(err);
        }
        debug('[%s] doCreate done : %j', dataset_id, res);
        cb(null, makeResponse(res.ops[0]));
      });
    },

    doRead: function(dataset_id, uid, meta_data, cb) {
      debug(
        '[%s] doRead :: %s :: meta=%j', dataset_id, uid, meta_data);
      mongo.collection(dataset_id).findOne({"_id": convertToObjectId(dataset_id, uid)}, function(err, found) {
        if (err) {
          return cb(err);
        }
        if (found) {
          delete found._id; //do not return _id field as part of the object
        }
        return cb(null, found);
      });
    },

    doUpdate: function(dataset_id, uid, data, meta_data, cb) {
      debug(
        '[%s] doUpdate :: %s :: %j :: meta=%j', dataset_id, uid, meta_data);
      mongo.collection(dataset_id).updateOne({"_id": convertToObjectId(dataset_id, uid)}, data, cb);
    },

    doDelete: function(dataset_id, uid, meta_data, cb) {
      debug(
        '[%s] doDelete :: %s :: meta=%j', dataset_id, uid, meta_data);
      mongo.collection(dataset_id).remove({"_id": convertToObjectId(dataset_id, uid)}, cb);
    },

    handleCollision: function(dataset_id, hash, timestamp, uid, pre, post, meta_data, cb) {
      var collisionFields = {
        uid: uid,
        hash: hash,
        pre: pre,
        post: post,
        timestamp: timestamp
      };
      debug(
        '[%s] doCollision :: collisionFields=%j :: meta=%j', dataset_id, collisionFields, meta_data);
      mongo.collection(collisionCollection(dataset_id)).insertOne(collisionFields, function(err, res) {
        if (err) {
          return cb(err);
        }
        cb(null, makeResponse(res.ops[0]));
      });
    },

    listCollisions: function(dataset_id, meta_data, cb) {
      debug(
        '[%s] listCollisions :: meta=%j', dataset_id, meta_data);
      mongo.collection(collisionCollection(dataset_id)).find().toArray(function(err, array) {
        if (err) {
          return cb(err);
        }
        cb(null, toObject(array));
      });
    },

    removeCollision: function(dataset_id, hash, meta_data, cb) {
      debug(
        '[%s] removeCollision :: hash=%s :: meta=%j', dataset_id, hash, meta_data);
      mongo.collection(collisionCollection(dataset_id)).remove({hash: hash}, cb);
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
