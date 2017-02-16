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
  'setGlobalResponseInterceptor': 'globalResponseInterceptor',
  'setGlobalHashHandler': 'globalHashHandler'
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
  },

  'should use the default hash handler': function () {
    var records = {
      'rec1': {
        name: 'fh.sync'
      },
      'rec2': {
        name: 'fh.cloud'
      }
    };

    mod.generateRecordHashes('dataset_name', records, function (err, res) {
      expect(err).to.be.null;
      expect(res.hash).to.be.a('string');

      expect(res.records.rec1.data.name).to.equal(records.rec1.name);
      expect(res.records.rec1.hash).to.be.a('string');

      expect(res.records.rec2.data.name).to.equal(records.rec2.name);
      expect(res.records.rec2.hash).to.be.a('string');
    });
  },

  'should use dataset specific hash handler': function () {
    var records = {
      'rec1': {
        name: 'fh.sync'
      },
      'rec2': {
        name: 'fh.cloud'
      }
    };

    var expectedHash = '1234567890';

    function hasher (/* record */) {
      // Obviously a terrible idea...
      return expectedHash;
    }

    mod.getDataset('dataset_name', function (err, dataset) {
      // mimic setting the handler via sync api
      dataset.hashHandler = hasher;

      mod.generateRecordHashes('dataset_name', records, function (err, res) {
        expect(err).to.be.null;
        expect(res.hash).to.be.a('string');
        expect(res.records).to.deep.equal({
          rec1: {
            data: records.rec1,
            hash: expectedHash
          },
          rec2: {
            data: records.rec2,
            hash: expectedHash
          }
        });
      });
    });
  },

  'should return a global hash, and individual hashes using "globalHashHandler"': function () {
    var records = {
      'rec1': {
        name: 'fh.sync'
      },
      'rec2': {
        name: 'fh.cloud'
      }
    };

    function hasher (record) {
      // Obviously a terrible idea, but proves the concept
      return JSON.stringify(record);
    }

    mod.setGlobalHashHandler(hasher);

    mod.generateRecordHashes('dataset_name', records, function (err, res) {
      expect(err).to.be.null;
      expect(res.hash).to.be.a('string');
      expect(res.records).to.deep.equal({
        rec1: {
          data: records.rec1,
          hash: hasher(records.rec1) // should match generated hash if our handler was used
        },
        rec2: {
          data: records.rec2,
          hash: hasher(records.rec2) // should match generated hash if our handler was used
        }
      });
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
