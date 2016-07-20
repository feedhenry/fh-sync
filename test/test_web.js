var fhhelpers = require("../lib/web-helpers.js"),
$fh = require("../lib/api.js");
var assert = require('assert');

module.exports = {

  'test option conversion': function(finish) {
    var fhOptions = {
      url: 'http://foo.bar:8888/one/two',
      method: 'POST',
      contentType: 'application/json',
      headers: [{name: 'foo', value: 'bar'}, {name: 'foo2', value: 'bar2'}],
      cookies: [{name: 'a', value: 'b'}, {name:'x', value: 'y'}]
    };

    var nodeOptions = fhhelpers.convertFHOptionsToNodeOptions(fhOptions);
    assert.equal(nodeOptions.host, 'foo.bar');
    assert.equal(nodeOptions.port, 8888);
    assert.equal(nodeOptions.path, '/one/two');
    assert.equal(nodeOptions.method, 'POST');
    assert.equal(nodeOptions.headers['content-type'], 'application/json');
    assert.equal(nodeOptions.headers.foo, 'bar');
    assert.equal(nodeOptions.headers.foo2, 'bar2');
    assert.equal(nodeOptions.headers.Cookie, 'a=b;x=y;');

    // test no callback pass to fh.web
    var gotException = false;
    try {
      $fh.web({});
    } catch (x) {
      gotException = true;
    }
    assert.equal(gotException, true);
    finish();
  },

  // TODO: following tests are quite brittle as they rely on an external service
  // being available. Given that it's one of our own requests to the AskMoby domain
  // though, we'd hope it would be available 24/7.

  'test fh.web() asynchronously': function(finish) {
    var fhOptions = {
      'url': 'http://www.google.ie',
      'method': "GET"
    };

    $fh.web(fhOptions, function(err, fhResp) {
      assert.notEqual(fhResp.body.count, 0);
      assert.equal(fhResp.status, 200);
      fhOptions.url = "http://www.google.ie/dsad";
      $fh.web(fhOptions, function(err, fhResp) {
        //assert.notEqual(fhResp.body.count, 0);
        assert.equal(fhResp.status, 404);
        finish();
      });
    });

    // TODO - test error cases, and also the 'error' array that needs to be returned
    // http://docs.feedhenry.com/wiki/Web_Requests
  },

  'test issue 3096 - illegal access': function(finish){
    var fhOptions = {
      'url': 'http://www.google.ie',
      'method': "GET",
      "headers": [{name: 'foo', value: 'bar'}, {name: 'foo2', value: 'bar2'}]
    };

    $fh.web(fhOptions, function(err, fhResp) {
      assert.notEqual(fhResp.body.count, 0);
      assert.equal(fhResp.status, 200);
      fhOptions.url = "http://www.google.ie/dsad";
      $fh.web(fhOptions, function(err, fhResp) {
        //assert.notEqual(fhResp.body.count, 0);
        assert.equal(fhResp.status, 404);
        finish();
      });
    });

  }
  /* TODO - need a
   , "bugfix 5155, $fh.web() cannot access a site with a ':<port>' in the address": function() {
   var fhserver = new fhs.FHServer(null, null);
   var fhOptions = {
   //'url': 'https://vmwarestaging.varicentondemand.com:13125/API/Table',
   url: 'http://e102-dynofarm-01.feedhenry.net:6080/',
   method: "GET"
   };

   fhserver.web(fhOptions, function(err, fhResp) {
   assert.equal(fhResp.status, 200);
   });
   }
   */
};