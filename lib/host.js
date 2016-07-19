var _ = require('lodash-contrib');
var request = require('request');

module.exports = function host(cb) {
  var url = 'https://' + process.env.FH_MILLICORE + '/box/srv/1.1/ide/apps/app/hosts';
  var data = {
    "guid": process.env.FH_INSTANCE,
    "env": process.env.FH_ENV
  }

  request.post({
    url: url,
    json: true,
    body: data
  }, function (err, res, body) {
    if (err) return cb(err);

    return cb(err, _.getPath(body, "hosts.url"));
  });
}