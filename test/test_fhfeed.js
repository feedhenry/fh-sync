// Copyright (c) FeedHenry 2011

var util = require('util'),
feedMock, $fh;
var assert = require('assert');

module.exports = {
  'setUp' : function(finish){
    feedMock = require('./fixtures/feed'); // needs to go here, as application.js is what requires fh-apis
    $fh = require("../lib/api.js");
    finish();
  },
  'test fh.feed() ': function(finish) {

    var opts = { 'link': 'http://www.feedhenry.com/feed', 'list-max': 10};
    $fh.feed(opts, function(err, feed) {
      assert.ok(!err, 'Error: ' + err);
      assert.ok(feed.status);
      feed = JSON.parse(feed.body);
      assert.equal(feed.list.length, 10);
      finish();
    });
  },
  'test fh.feed() bad args': function(finish) {
    var gotException = false;
    try {
      $fh.feed({});
    } catch (x) {
      gotException = true;
    }
    assert.equal(gotException, true);
    finish();
  },
  'tearDown' : function(finish){
    feedMock.done();
    finish();
  }
};
