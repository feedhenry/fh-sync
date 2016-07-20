var assert = require('assert');
var initScript = require("../lib/init.js");

var mockedLogger = {
  error: function (message) {
    this.message = message;
  }
}

module.exports = {
  'Test init without environment variable': function (finish) {
    // Make sure that env is empty
    delete process.env.NODE_MAX_SOCKETS_COUNT;
    initScript(mockedLogger);
    assert.equal(require('https').globalAgent.maxSockets, Infinity);
    assert.equal(require('http').globalAgent.maxSockets,Infinity);
    finish();
  },
  'Test init with environment variable': function (finish) {
    process.env.NODE_MAX_SOCKETS_COUNT=30;
    initScript(mockedLogger);
    assert.equal(require('https').globalAgent.maxSockets, 30);
    assert.equal(require('http').globalAgent.maxSockets,30);
    finish();
  },
  'Test init with invalid environment variable': function (finish) {
    process.env.NODE_MAX_SOCKETS_COUNT="Unclear";
    initScript(mockedLogger);
    assert.ok(mockedLogger.message);
    assert.equal(require('https').globalAgent.maxSockets, Infinity);
    assert.equal(require('http').globalAgent.maxSockets,Infinity);
    finish();
  },
}