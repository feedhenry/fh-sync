var sinon = require('sinon');
var consolelogger = require('../lib/consolelogger');
var expect = require('chai').expect;
require('mocha-sinon');

var logger = new consolelogger.ConsoleLogger();


module.exports = {
  beforeEach: function() {
    var log = console.log;
    this.sinon.stub(console, 'log', function() {
      return log.apply(log, arguments);
    });
  },

  'test error log level 0': function(done) {
    logger.setLogLevel(consolelogger.LEVEL.ERROR);
    logger.error('error');
    expect(console.log.calledWith(sinon.match(' ERROR error'))).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(sinon.match(' WARN warning'))).to.be.false;
    logger.info('info');
    expect(console.log.calledWith(sinon.match(' INFO info'))).to.be.false;
    logger.debug('debug');
    expect(console.log.calledWith(sinon.match(' DEBUG debug'))).to.be.false;
    done();
  },

  'test error log level 1': function(done) {
    logger.setLogLevel(consolelogger.LEVEL.WARN);
    logger.error('error');
    expect(console.log.calledWith(sinon.match(' ERROR error'))).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(sinon.match(' WARN warning'))).to.be.true;
    logger.info('info');
    expect(console.log.calledWith(sinon.match(' INFO info'))).to.be.false;
    logger.debug('debug');
    expect(console.log.calledWith(sinon.match(' DEBUG debug'))).to.be.false;
    done();
  },

  'test error log level 2': function(done) {
    logger.setLogLevel(consolelogger.LEVEL.INFO);
    logger.error('error');
    expect(console.log.calledWith(sinon.match(' ERROR error'))).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(sinon.match(' WARN warning'))).to.be.true;
    logger.info('info');
    expect(console.log.calledWith(sinon.match(' INFO info'))).to.be.true;
    logger.debug('debug');
    expect(console.log.calledWith(sinon.match(' DEBUG warning'))).to.be.false;
    done();
  },

  'test error log level 3': function(done) {
    logger.setLogLevel(consolelogger.LEVEL.DEBUG);
    logger.error('error');
    expect(console.log.calledWith(sinon.match(' ERROR error'))).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(sinon.match(' WARN warning'))).to.be.true;
    logger.info('info');
    expect(console.log.calledWith(sinon.match(' INFO info'))).to.be.true;
    logger.debug('debug');
    expect(console.log.calledWith(sinon.match(' DEBUG debug'))).to.be.true;
    done();
  }
};