var sinon = require('sinon');
var consolelogger = require('../lib/consolelogger');
var expect = require('chai').expect;
require('mocha-sinon');

var logger = new consolelogger.ConsoleLogger();


function getTS() {
  var d = new Date();
  var day = d.getDate() < 10 ? "0" + d.getDate() : d.getDate();
  var mon = d.getMonth() < 10 ? "0" + d.getMonth() : d.getMonth();
  var hour = d.getHours() < 10 ? "0" + d.getHours() : d.getHours();
  var min = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes();
  var sec = d.getSeconds() < 10 ? "0" + d.getSeconds() : d.getSeconds();

  return d.getFullYear() + "-" + mon + "-" + day +
    " " + hour + ":" + min + ":" + sec;
}


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
    expect(console.log.calledWith(getTS() + ' ERROR error')).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(getTS() + ' WARN warning')).to.be.false;
    logger.info('info');
    expect(console.log.calledWith(getTS() + ' INFO info')).to.be.false;
    logger.debug('debug');
    expect(console.log.calledWith(getTS() + ' DEBUG debug')).to.be.false;
    done();
  },

  'test error log level 1': function(done) {
    logger.setLogLevel(consolelogger.LEVEL.WARN);
    logger.error('error');
    expect(console.log.calledWith(getTS() + ' ERROR error')).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(getTS() + ' WARN warning')).to.be.true;
    logger.info('info');
    expect(console.log.calledWith(getTS() + ' INFO info')).to.be.false;
    logger.debug('debug');
    expect(console.log.calledWith(getTS() + ' DEBUG debug')).to.be.false;
    done();
  },

  'test error log level 2': function(done) {
    logger.setLogLevel(consolelogger.LEVEL.INFO);
    logger.error('error');
    expect(console.log.calledWith(getTS() + ' ERROR error')).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(getTS() + ' WARN warning')).to.be.true;
    logger.info('info');
    expect(console.log.calledWith(getTS() + ' INFO info')).to.be.true;
    logger.debug('debug');
    expect(console.log.calledWith(getTS() + ' DEBUG warning')).to.be.false;
    done();
  },

  'test error log level 3': function(done) {
    logger.setLogLevel(consolelogger.LEVEL.DEBUG);
    logger.error('error');
    expect(console.log.calledWith(getTS() + ' ERROR error')).to.be.true;
    logger.warning('warning');
    expect(console.log.calledWith(getTS() + ' WARN warning')).to.be.true;
    logger.info('info');
    expect(console.log.calledWith(getTS() + ' INFO info')).to.be.true;
    logger.debug('debug');
    expect(console.log.calledWith(getTS() + ' DEBUG debug')).to.be.true;
    done();
  }
};