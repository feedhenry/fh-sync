/**
 * Init script responsible for setting required parameters
 */
var debugError = require('debug')('fh-mbaas-api:init:error');

module.exports = function init() {
  var maxSocketCount = Infinity;
  if (process.env.NODE_MAX_SOCKETS_COUNT) {
    var count = process.env.NODE_MAX_SOCKETS_COUNT;
    if (isNaN(count)) {
      debugError("Invalid NODE_MAX_SOCKETS_COUNT environment variable: " + count);
    } else {
      maxSocketCount = Number(process.env.NODE_MAX_SOCKETS_COUNT);
    }
  }
  require('https').globalAgent.maxSockets = maxSocketCount;
  require('http').globalAgent.maxSockets = maxSocketCount;
};
