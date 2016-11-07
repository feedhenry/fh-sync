'use strict';

describe('sync dataset model', function () {

  var sinon = require('sinon');
  var expect = require('chai').expect;

  var mod;

  beforeEach(function () {
    // Clear all require cache to ensure old datasets etc. aren't hanging about
    require('clear-require').all();

    mod = require('lib/sync-DataSetModel');
  });

  describe('global setters', function () {
    var map = {
      'setGlobalListHandler': 'globalListHandler',
      'setGlobalCreateHandler': 'globalCreateHandler',
      'setGlobalReadHandler': 'globalReadHandler',
      'setGlobalUpdateHandler': 'globalUpdateHandler',
      'setGlobalDeleteHandler': 'globalDeleteHandler',
      'setGlobalCollisionHandler': 'globalCollisionHandler',
      'setGlobalCollisionLister': 'globalCollisionLister',
      'setGlobalCollisionRemover': 'globalCollisionRemover',
      'setGlobalRequestInterceptor': 'globalRequestInterceptor'
    };

    Object.keys(map).forEach(function (fnName) {
      describe('#' + fnName, function () {
        it('should throw an AssertionError due invalid argument', function () {
          expect(function () {
            mod[fnName](null)
          }).to.throw(
            'AssertionError: sync handler (' + map[fnName] + ') must be a function'
          );
        });

        it('should set the ' + map[fnName] + ' property', function () {
          var spy = sinon.spy();
          expect(function () {
            mod[fnName](spy)
          }).to.not.throw();
        });
      });
    });

    it('should use a custom "globalRequestInterceptor"', function (done) {
      var customInterceptor = sinon.stub().yields(null);

      mod.setGlobalRequestInterceptor(customInterceptor);

      mod.doRequestInterceptor('a', {}, function (err) {
        expect(err).to.be.null;
        expect(customInterceptor.called).to.be.true;
        done();
      });
    });
  });

});
