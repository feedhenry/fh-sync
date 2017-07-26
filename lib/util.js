var crypto = require('crypto');
var assert = require('assert');
var _ = require('underscore');
var debug = require('debug')('fh-mbaas-api:sync');

/**
 * Wrap around `console.error`.
 */
var debugError = function() {
  console.error.apply(this, arguments);
}

var generateHash = function(plainText) {
  var hash;
  if (plainText) {
    if ('string' !== typeof plainText) {
      plainText = sortedStringify(plainText);
    }
    var shasum = crypto.createHash('sha1');
    shasum.update(plainText);
    hash = shasum.digest('hex');
  }
  return hash;
};

var sortObject = function(object) {
  if (typeof object !== "object" || object === null) {
    return object;
  }

  var result = [];

  Object.keys(object).sort().forEach(function(key) {
    result.push({
      key: key,
      value: sortObject(object[key])
    });
  });

  return result;
};

var sortedStringify = function(obj) {
  var str = '';
  try {
    if (obj) {
      str = JSON.stringify(sortObject(obj));
    }
  } catch (e) {
    debugError('Error stringifying sorted object: %s', e);
    throw e;
  }

  return str;
};

var getCuid = function(params) {
  var cuid = '';
  if (params && params.__fh && params.__fh.cuid) {
    cuid = params.__fh.cuid;
  }
  return cuid;
};

/**
 * convert the given array to an object, use the `uid` field of each item as the key
 * @param {Array} itemArr
 * @returns an object
 */
function convertToObject(itemArr) {
  var obj = {};
  _.each(itemArr, function(item) {
    obj[item.uid] = item;
  });
  return obj;
}

exports.ensureHandlerIsFunction = function(target, fn) {
  assert.equal(
    typeof fn,
    'function',
    'sync handler (' + target + ') must be a function'
  );
};

module.exports.generateHash = generateHash;
module.exports.sortObject = sortObject;
module.exports.sortedStringify = sortedStringify;
module.exports.getCuid = getCuid;
module.exports.convertToObject = convertToObject;
module.exports.debug = debug;
module.exports.debugError = debugError;