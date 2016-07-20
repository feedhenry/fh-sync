var assert = require('assert');
var futils = require('../lib/fhutils');
var fhutils = new futils({});

module.exports = {
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
