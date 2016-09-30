var assert = require('assert');
var futils = require('../lib/fhutils');
var fhutils = new futils({});
var expect = require('chai').expect;

module.exports = {
  'test addAppApiKeyHeader - without override': function () {
    var fhutils = new futils({
      APP_API_KEY_HEADER: 'x-fh-api-key',
      fhapi: {
        appapikey: 'thedefaultapikey'
      }
    });

    var headers = {
      'x-custom-header': 'rhmap rocks'
    };

    fhutils.addAppApiKeyHeader(headers);

    expect(headers).to.deep.equal({
      'x-custom-header': 'rhmap rocks',
      'x-fh-api-key': 'thedefaultapikey'
    });
  },

  'test addAppApiKeyHeader - with override': function () {
    var fhutils = new futils({
      APP_API_KEY_HEADER: 'x-fh-api-key',
      fhapi: {
        appapikey: 'thedefaultapikey'
      }
    });

    var headers = {
      'x-custom-header': 'rhmap rocks'
    };

    var customApiKey = 'thecustomapikey';

    fhutils.addAppApiKeyHeader(headers, customApiKey);

    expect(headers).to.deep.equal({
      'x-custom-header': 'rhmap rocks',
      'x-fh-api-key': customApiKey
    });
  },
  
  'test urlPathJoin': function(finish) {

    assert.equal(fhutils.urlPathJoin('/p1', '/p2'),              "/p1/p2");
    assert.equal(fhutils.urlPathJoin('p1', '/p2'),               "/p1/p2");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2'),               "/p1/p2");
    assert.equal(fhutils.urlPathJoin('p1', 'p2'),                "/p1/p2");
    assert.equal(fhutils.urlPathJoin('/p1/', '/p2'),              "/p1/p2");
    assert.equal(fhutils.urlPathJoin('p1/', '/p2'),               "/p1/p2");
    assert.equal(fhutils.urlPathJoin('/p1/', 'p2'),               "/p1/p2");
    assert.equal(fhutils.urlPathJoin('p1/', 'p2'),                "/p1/p2");
    assert.equal(fhutils.urlPathJoin('/p1/p2', '/p3'),           "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1/p2/', '/p3'),          "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1/p2/', 'p3'),           "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2', '/p3'),       "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('p1', '/p2', '/p3'),        "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2', '/p3'),        "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2', 'p3'),        "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('p1', 'p2', 'p3'),          "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2', '/p3'),        "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2/p3'),           "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2/p3'),            "/p1/p2/p3");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2', '/p3', 'p4'), "/p1/p2/p3/p4");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2/'),              "/p1/p2/");
    assert.equal(fhutils.urlPathJoin('p1', '/p2/'),               "/p1/p2/");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2/'),               "/p1/p2/");
    assert.equal(fhutils.urlPathJoin('p1', 'p2/'),                "/p1/p2/");
    assert.equal(fhutils.urlPathJoin('/p1/p2', '/p3/'),           "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1/p2/', '/p3/'),          "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1/p2/', 'p3/'),           "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2', '/p3/'),       "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('p1', '/p2', '/p3/'),        "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2', '/p3/'),        "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2', 'p3/'),        "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('p1', 'p2', 'p3/'),          "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2', '/p3/'),        "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2/p3/'),           "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1', 'p2/p3/'),            "/p1/p2/p3/");
    assert.equal(fhutils.urlPathJoin('/p1', '/p2', '/p3', 'p4/'), "/p1/p2/p3/p4/");
    finish();
  }
};
