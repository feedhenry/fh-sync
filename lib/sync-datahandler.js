var syncUtil = require('./sync-util');
var util = require('util');
var _ = require('underscore');
var fhdb;

module.exports = {

  setFHDB: function (db) {
    fhdb = db;
  },

  // Default to the built in hashing algorithm
  doHash: syncUtil.generateHash,

  doList: function (dataset_id, params, cb, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'doList : ' + dataset_id + ' :: query_params=' + util.inspect(params) + ' :: meta_data=' + util.inspect(meta_data));


    var dbQuery = {};
    _.extend(dbQuery, params, {
      "act": "list",
      "type": dataset_id
    });

    fhdb(dbQuery, function (err, res) {
      if (err) return cb(err);

      var resJson = {};
      if (res.hasOwnProperty('list')) {
        for (var di = 0, dl = res.list.length; di < dl; di += 1) {
          resJson[res.list[di].guid] = res.list[di].fields;
        }
      }
      else {
        syncUtil.doLog('list property not returned in response from fhdb.');
      }
      return cb(null, resJson);
    });
  },

  doCreate: function (dataset_id, data, cb, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'doCreate : ' + dataset_id + ' :: ' + util.inspect(data) + ' :: meta=' + util.inspect(meta_data));

    fhdb({
      "act": "create",
      "type": dataset_id,
      "fields": data
    }, function (err, res) {
      if (err) return cb(err);
      var data = {'uid': res.guid, 'data': res.fields};
      return cb(null, data);
    });
  },

  doRead: function (dataset_id, uid, cb, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'doRead : ' + dataset_id + ' :: ' + uid + ' :: meta=' + util.inspect(meta_data));

    fhdb({
      "act": "read",
      "type": dataset_id,
      "guid": uid
    }, function (err, res) {
      if (err) return cb(err);
      return cb(null, res.fields);
    });
  },

  doUpdate: function (dataset_id, uid, data, cb, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'doUpdate : ' + dataset_id + ' :: ' + uid + ' :: ' + util.inspect(data) + ' :: meta=' + util.inspect(meta_data));

    fhdb({
      "act": "update",
      "type": dataset_id,
      "guid": uid,
      "fields": data
    }, function (err, res) {
      if (err) return cb(err);
      return cb(null, res.fields);
    });
  },

  doDelete: function (dataset_id, uid, cb, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'doDelete : ' + dataset_id + ' :: ' + uid + ' :: meta=' + util.inspect(meta_data));

    fhdb({
      "act": "delete",
      "type": dataset_id,
      "guid": uid
    }, function (err, res) {
      if (err) return cb(err);
      return cb(null, res.fields);
    });
  },

  doCollision: function (dataset_id, hash, timestamp, uid, pre, post, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'doCollision : ' + dataset_id + ' :: hash=' + hash + ' :: timestamp=' + timestamp + ' :: uid=' + uid + ' :: pre=' + util.inspect(pre) + ' :: post=' + util.inspect(post) + ' :: meta=' + util.inspect(meta_data));

    var fields = {
      "hash": hash,
      "timestamp": timestamp,
      "uid": uid,
      "pre": pre,
      "post": post
    };

    fhdb({
      "act": "create",
      "type": dataset_id + '_collision',
      "fields": fields
    }, function (err) {
      if (err) console.log(err);
    });
  },

  listCollisions: function (dataset_id, cb, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'listCollisions : ' + dataset_id + ' :: meta=' + util.inspect(meta_data));
    fhdb({
      "act": "list",
      "type": dataset_id + '_collision'
    }, function (err, res) {
      if (err) return cb(err);

      var resJson = {};

      for (var di = 0; di < res.list.length; di++) {
        resJson[res.list[di].fields.hash] = res.list[di].fields;
      }

      cb(null, resJson);
    });
  },

  removeCollision: function (dataset_id, hash, cb, meta_data) {
    syncUtil.doLog(dataset_id, 'verbose', 'removeCollision : ' + dataset_id + ' :: hash=' + hash + ' :: meta=' + util.inspect(meta_data));
    fhdb({
      "act": "list",
      "type": dataset_id + '_collision',
      "eq": {
        "hash": hash
      }
    }, function (err, data) {
      if (err) cb(err);

      if (data.list && data.list.length === 1) {
        var guid = data.list[0].guid;
        fhdb({
          "act": "delete",
          "type": dataset_id + '_collision',
          "guid": guid
        }, cb);
      } else {
        return cb(null, {"status": "ok", "message": "No collision found for hash " + hash});
      }
    });
  }
};
