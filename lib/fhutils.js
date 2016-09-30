var assert = require('assert');

module.exports = function (cfg) {
  assert.ok(cfg, 'cfg is undefined');

  /**
   * Injects an RHMAP API Key into a provided Object "headers" Object.
   *
   * By default this will use the API Key for the running node process, but
   * passing a custom "value" is also supported.
   * @param {Object} headers
   * @param {String} [value]
   */
  this.addAppApiKeyHeader = function (headers, value) {
    if (cfg.fhapi && cfg.fhapi.appapikey && cfg.fhapi.appapikey.length > 0) {
      headers[cfg.APP_API_KEY_HEADER] = value || cfg.fhapi.appapikey;
    }
  };

  this.getMillicoreProps = function () {
    var props = {};
    if (cfg && cfg.fhapi) {
      return cfg.fhapi;
    }
    return props;
  };

  function urlPathJoin2(pathPart1, pathPart2) {
    var pathStr = pathPart1;
    if(pathStr.substr(-1) !== '/') { // doesn't already have traiiling slash
      pathStr += '/';
    }
    if(pathPart2.substr(0,1) === '/') {  // has a leading slask
      pathStr += pathPart2.substr(1); // append without leading slash
    } else { // does not have leading slash
      pathStr += pathPart2;
    }
    return pathStr;
  }

  this.urlPathJoin = function urlPathJoinFunc() { //
    var pathStr = '';
    var numPathPaths = arguments.length;
    var i;
    for(i = 0; i < numPathPaths; i += 1) {
      pathStr = urlPathJoin2(pathStr, arguments[i]);
    }
    return pathStr;
  }
};
