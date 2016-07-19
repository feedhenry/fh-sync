var packageJSON = require('../package.json');
var assert = require('assert');

module.exports = {
  "It Should Get The Current Version Of fh-mbaas-api": function(done){
    var $fh = require('../lib/api.js');

    assert.ok($fh.getVersion(), "Expected A Version To Be Returned");
    assert.equal(packageJSON.version, $fh.getVersion());
    done();
  }
};