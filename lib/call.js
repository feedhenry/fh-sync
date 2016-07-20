var config,
  _ = require('underscore'),
  https = require('https'),
  futils = require('./fhutils'),
  fhutils;
module.exports = function (cfg) {
  config = cfg;
  fhutils = new futils(config);
  return call;
};

//
// $fh.call() : Call back to millicore from our Node.js code.
// NOT a public function but may be one day.
// TODO - note that it uses hardcoded https here.
var call = function call(path, params, callback) {
  var headers = {
      "accept": "application/json"
    },
    logger = config.logger;
  var props = fhutils.getMillicoreProps();
  headers["content-type"] = "application/json; charset=utf-8";
  fhutils.addAppApiKeyHeader(headers);

  var options = {
    host: props.millicore,
    port: props.port,
    path: '/box/srv/1.1/' + path,
    method: 'POST',
    headers: headers
  };

  var addParams = (params === undefined || params === null) ? {} : _.clone(params);
  addParams["instance"] = props.instId;
  addParams["widget"] = props.widgId;

  var fhResp = {};
  var req = https.request(options, function (res) {
    fhResp.status = res.statusCode;
    // TODO - *both* of these are recommended ways of setting timeout on http requests..
    // needs further investigation (and proper test case!!)

    // bob build didnt like below..above suggests it was never verified?? ... changed to this to add timeout
    //req.socket && req.socket.setTimeout(config.socketTimeout);
    //req.connection.setTimeout && req.connection.setTimeout(config.socketTimeout);
    req.on('socket', function (socket){
      socket.setTimeout(config.socketTimeout);
    });
    req.on('connect', function (res, socket){
      socket.setTimeout(config.socketTimeout);
    });

    var data = '';
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      data += chunk;
    });

    res.on('end', function () {
      fhResp.body = data;
      callback(undefined, fhResp);
    });
  });

  req.on('error', function (e) {
    logger.warning('Problem invoking: ' + e.message);
    callback(e);
  });

  req.write(JSON.stringify(addParams) + "\n");
  req.end();
};
