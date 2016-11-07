'use strict';

describe('sync utils', function () {

  var sinon = require('sinon');
  var expect = require('chai').expect;
  var mod;

  beforeEach(function () {
    // Clear all require cache to ensure old datasets etc. aren't hanging about
    require('clear-require').all();

    // Creates a new sync instance
    mod = require('lib/sync-util');
  });

  describe('#ensureHandlerIsFunction', function () {
    it('should throw an AssertionError if not passed a function', function () {
      expect(function () {
        mod.ensureHandlerIsFunction('listHandler', {});
      }).to.throw(
        'AssertionError: sync handler (listHandler) must be a function'
      );
    });

    it('should not throw an AssertionError if passed a function', function () {
      expect(function () {
        mod.ensureHandlerIsFunction('listHandler', sinon.spy());
      }).to.not.throw();
    });
  });

});
