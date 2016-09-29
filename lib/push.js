var assert = require('assert'),
  futils = require('./fhutils'),
  xtend = require('xtend');

module.exports = function (cfg) {
  assert.ok(cfg, 'cfg is undefined');

  var fhutils = new futils(cfg);
  var millicoreProps = fhutils.getMillicoreProps();
  var defaultPushSettings = getPushSettings(millicoreProps);

  /**
   * Generates settings to the used when creating an AeroGear.sender.
   * @param  {Object} opts [description]
   * @return {Object}
   */
  function getPushSettings (opts) {
    assert.ok(opts, 'opts is undefined');

    var headers = {
      'X-Project-Id': opts.widget,
      'X-App-Id': opts.instance
    };

    fhutils.addAppApiKeyHeader(headers, opts.appapikey);

    return {
      url: 'https://' + opts.millicore + ':' + opts.port + '/box/api/unifiedpush/mbaas/',
      applicationId: "fake", // we have to use fake ID, it will be added by supercore
      masterSecret: "fake", // we have to use fake secret, it will be added by supercore
      headers: headers
    };
  }


  /**
   * Creates a push client (aka the $fh.push API)
   * @param  {Object}   settings
   * @return {Function}
   */
  function getPushClient (settings) {
    var sender = null;

    return function push (message, options, callback) {
      if (!message) return callback(new Error("Missing required 'message' parameter"));
      if (!options) return callback(new Error("Missing required 'options' parameter"));
      if (!options.broadcast) {
        if (!options.apps) return callback(new Error("Missing required 'options.apps' parameter while 'options.broadcast' not specified" + JSON.stringify(options)));
      }

      if (!sender) {
        sender = require('unifiedpush-node-sender').Sender(settings);
      }

      sender.send(message, options, callback);
    };
  }

  // $fh.push
  var push = getPushClient(defaultPushSettings);

  /**
   * Allows developers to get a custom $fh.push instance that targets a
   * specific project. Useful if this app is an MBaaS Service.
   * @param  {Object} overrides
   * @return {Function}
   */
  push.getPushClient = function (overrides) {
    // Create settings for a new push client, but add in overrides such as using
    // a custom widget and instance (project and cloud app id)
    var settings = getPushSettings(
      xtend(millicoreProps, overrides)
    );

    return getPushClient(settings);
  };

  return push;
};
