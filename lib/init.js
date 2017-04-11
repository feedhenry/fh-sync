/**
 * Init script responsible for setting required parameters
 */
var debug = require('debug')("fh-mbaas-api:init");

module.exports = function init() {
  var maxSocketCount = Infinity;
  if (process.env.NODE_MAX_SOCKETS_COUNT) {
    var count = process.env.NODE_MAX_SOCKETS_COUNT;
    if (isNaN(count)) {
      debug("Invalid NODE_MAX_SOCKETS_COUNT environment variable: " + count);
    } else {
      maxSocketCount = Number(process.env.NODE_MAX_SOCKETS_COUNT);
    }
  }
  require('https').globalAgent.maxSockets = maxSocketCount;
  require('http').globalAgent.maxSockets = maxSocketCount;
};
