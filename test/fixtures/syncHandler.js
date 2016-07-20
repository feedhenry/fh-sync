
exports.doList = function(dataset_id, params, cb) {
  console.log("doList : ", dataset_id, " :: ", params);
  return cb(null, {});
};

exports.doCreate = function(dataset_id, data, cb) {
  console.log("doCreate : ", dataset_id, " :: ", data);
  return cb(null, {});
};

exports.doRead = function(dataset_id, uid, cb) {
  console.log("doRead : ", dataset_id, " :: ", uid);
  return cb(null, {});
};

exports.listCollissions = function(dataset_id, uid, cb) {
  console.log("listCollisions : ", dataset_id, " :: ", uid);
  return cb(null, {});
};

exports.doUpdate = function(dataset_id, uid, data, cb) {
  console.log("doUpdate : ", dataset_id, " :: ", uid, " :: ", data);
  return cb(null, {});
};

exports.doDelete = function(dataset_id, uid, cb) {
  console.log("doDelete : ", dataset_id, " :: ", uid);
  return cb(null, {});
};

exports.doCollision = function(dataset_id, hash, uid, pre, post) {
  console.log("doCollision : ", dataset_id, " :: hash= ", hash, " :: uid= ", uid, " :: pre= ", pre, " :: post= ", post);
  return cb(null, {});
};

exports.removeCollision = function(dataset_id, hash, cb) {
  return cb(null, {});
}