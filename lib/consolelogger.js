//
// Console Logger, optional replacement for log4js
//

// 0 error, 1 warning, 2 info, 3 debug
var LEVEL = {
  NONE: -1,
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};
var loglevel = LEVEL.INFO;

function ConsoleLogger(level) {
  if (undefined !== level) {
    loglevel = level;
  }
}

function getTS() {
  var d = new Date();
  var day = d.getDate() < 10 ? "0" + d.getDate() : d.getDate();
  var mon = d.getMonth() < 10 ? "0" + d.getMonth() : d.getMonth();
  var hour = d.getHours() < 10 ? "0" + d.getHours() : d.getHours();
  var min = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes();
  var sec = d.getSeconds() < 10 ? "0" + d.getSeconds() : d.getSeconds();

  return d.getFullYear() + "-" + mon + "-" + day +
    " " + hour + ":" + min + ":" + sec;
}

ConsoleLogger.prototype.setLogLevel = function(level) {
  loglevel = level;
};

ConsoleLogger.prototype.error = function (data) {
  if (loglevel >= 0) {
    console.log(getTS() + " ERROR " + data);
  }
};

ConsoleLogger.prototype.warning = function (data) {
  if (loglevel >= 1) {
    console.log(getTS() + " WARN " + data);
  }
};

ConsoleLogger.prototype.info = function (data) {
  if (loglevel >= 2) {
    console.log(getTS() + " INFO " + data);
  }
};

ConsoleLogger.prototype.debug = function (data) {
  if (loglevel >= 3) {
    console.log(getTS() + " DEBUG " + data);
  }
};

exports.ConsoleLogger = ConsoleLogger;
exports.LEVEL = LEVEL;
