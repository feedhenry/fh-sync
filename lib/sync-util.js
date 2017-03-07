var crypto = require('crypto');
var winston = require('winston');
var moment = require('moment');
var assert = require('assert');

var SYNC_LOGGER = 'SYNC';
var loggers = {};

var generateHash = function (plainText/*, recordId */) {
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
}

var sortObject = function (object) {
  if (typeof object !== "object" || object === null) {
    return object;
  }

  var result = [];

  Object.keys(object).sort().forEach(function (key) {
    result.push({
      key: key,
      value: sortObject(object[key])
    });
  });

  return result;
}


var sortedStringify = function (obj) {
  var str = '';
  try {
    if (obj) {
      str = JSON.stringify(sortObject(obj));
    }
  } catch (e) {
    doLog(SYNC_LOGGER, 'error', 'Error stringifying sorted object:' + e);
    throw e;
  }

  return str;
}

var setLogger = function (dataset_id, options) {
  var level = options.logLevel;
  var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({level: level, debugStdout: true})
    ]
  });

  loggers[dataset_id] = logger;
}

var doLog = function (dataset_id, level, msg, params) {

  var logger = loggers[dataset_id] || loggers[SYNC_LOGGER];
  if (logger) {
    var logMsg = moment().format('YYYY-MM-DD HH:mm:ss') + ' [' + dataset_id + '] ';
    logMsg += '(' + getCuid(params) + ')';
    logMsg = logMsg + ': ' + msg;

    logger.log(level, logMsg);
  }
}

var getCuid = function (params) {
  var cuid = '';
  if (params && params.__fh && params.__fh.cuid) {
    cuid = params.__fh.cuid;
  }
  return cuid;
}

exports.ensureHandlerIsFunction = function (target, fn) {
  assert.equal(
    typeof fn,
    'function',
    'sync handler (' + target + ') must be a function'
  );
};

module.exports.generateHash = generateHash;
module.exports.sortObject = sortObject;
module.exports.sortedStringify = sortedStringify;
module.exports.setLogger = setLogger;
module.exports.doLog = doLog;
module.exports.getCuid = getCuid;
module.exports.SYNC_LOGGER = SYNC_LOGGER;
