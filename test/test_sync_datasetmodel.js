var sinon = require('sinon');
var expect = require('chai').expect;

var mod;

var map = {
  'setGlobalListHandler': 'globalListHandler',
  'setGlobalCreateHandler': 'globalCreateHandler',
  'setGlobalReadHandler': 'globalReadHandler',
  'setGlobalUpdateHandler': 'globalUpdateHandler',
  'setGlobalDeleteHandler': 'globalDeleteHandler',
  'setGlobalCollisionHandler': 'globalCollisionHandler',
  'setGlobalCollisionLister': 'globalCollisionLister',
  'setGlobalCollisionRemover': 'globalCollisionRemover',
  'setGlobalRequestInterceptor': 'globalRequestInterceptor',
  'setGlobalResponseInterceptor': 'globalResponseInterceptor'
};

var tests = {
  beforeEach: function () {
    // Clear all require cache to ensure old datasets etc. aren't hanging about
    require('clear-require').all();

    mod = require('../lib/sync-DataSetModel');
  },

  'should use a custom "globalRequestInterceptor"': function (done) {
    var customInterceptor = sinon.stub().yields(null);

    mod.setGlobalRequestInterceptor(customInterceptor);

    mod.doRequestInterceptor('a', {}, function (err) {
      expect(err).to.be.null;
      expect(customInterceptor.called).to.be.true;
      done();
    });
  }
};

Object.keys(map).forEach(function (fnName) {
  var handlerTests = {}
  
  handlerTests['should throw an AssertionError due invalid argument'] = function () {
    expect(function () {
      mod[fnName](null)
    }).to.throw(
      'AssertionError: sync handler (' + map[fnName] + ') must be a function'
    );
  };

  handlerTests['should set the ' + map[fnName] + ' property'] = function () {
    var spy = sinon.spy();
    expect(function () {
      mod[fnName](spy)
    }).to.not.throw();
  }

  tests['#' + fnName] = handlerTests;  
});

module.exports = tests;