var sinon = require('sinon');
var expect = require('chai').expect;
var proxyquire = require('proxyquire').noCallThru();

var STUB_NAMES = {
  DB: './db',
  SYNC_UTIL: './sync-util',
  DATA_MODEL: './sync-DataSetModel'
};

var sync, db, stubs;

module.exports = {

  beforeEach: function () {
    // Clear all require cache to ensure old datasets etc. aren't hanging about
    require('clear-require').all();

    db = sinon.stub();

    // Once we drop node 0.10 we'll be able to use the new object literals here!
    stubs = {};
    stubs[STUB_NAMES.DB] = sinon.stub().returns(db);
    stubs[STUB_NAMES.SYNC_UTIL] = {
      ensureHandlerIsFunction: sinon.stub(),
      setLogger: sinon.spy()
    };
    stubs[STUB_NAMES.DATA_MODEL] = {
      getDataset: sinon.stub(),
      setFHDB: sinon.spy(),
      init: sinon.spy(),
      createDataset: sinon.spy(),
      stopDatasetSync: sinon.spy(),
      stopAllDatasetSync: sinon.stub().callsArgAsync(0),
      toJSON: sinon.spy(),
      setGlobalListHandler: sinon.spy(),
      setGlobalCreateHandler: sinon.spy(),
      setGlobalReadHandler: sinon.spy(),
      setGlobalUpdateHandler: sinon.spy(),
      setGlobalDeleteHandler: sinon.spy(),
      setGlobalCollisionHandler: sinon.spy(),
      setGlobalCollisionLister: sinon.spy(),
      setGlobalCollisionRemover: sinon.spy(),
      setGlobalRequestInterceptor: sinon.spy(),
      setGlobalResponseInterceptor: sinon.spy(),
      setGlobalHashHandler: sinon.spy()
    };

    // Creates a new sync instance
    sync = proxyquire('../lib/sync-srv', stubs)({});
  },

  'should have initialised the db connection DataSetModel': function () {
    expect(stubs[STUB_NAMES.DATA_MODEL].setFHDB.called).to.be.true;
    expect(stubs[STUB_NAMES.DATA_MODEL].init.called).to.be.true;
  },

  'setters for custom handlers': {
    'should throw an AssertionError if not passed a function': function () {
      stubs[STUB_NAMES.SYNC_UTIL].ensureHandlerIsFunction.throwsException(
        new Error('AssertionError')
      );

      expect(function () {
        sync.handleList('my-dataset', {});
      }).to.throw('AssertionError');
    },

    'should not throw an AssertionError if passed a function': function () {
      stubs[STUB_NAMES.SYNC_UTIL].ensureHandlerIsFunction.returns(null);

      expect(function () {
        sync.handleList('my-dataset', sinon.spy());
      }).to.not.throw();

      expect(stubs[STUB_NAMES.DATA_MODEL].getDataset.called).to.be.true;
    }
  },

  '#invoke': {
    'should return error if params is not provided': function (done) {
      sync.invoke('my-dataset', null, function (err) {
        expect(err).to.equal('no_fn');
        done();
      });
    },

    'should return error if params.fn is not provided': function (done) {
      sync.invoke('my-dataset', {}, function (err) {
        expect(err).to.equal('no_fn');
        done();
      });
    },

    'should return error if invalid params.fn is provided': function (done) {
      sync.invoke('my-dataset', {
        fn: '!blah!'
      }, function (err) {
        expect(err).to.equal('unknown_fn : !blah!');
        done();
      });
    }
  },

  '#setLogLevel': {
    'should return error if params.logLevel is undefined': function (done) {
      sync.setLogLevel('my-dataset', {}, function (err) {
        expect(err).to.equal('logLevel parameter required');
        done();
      });
    },

    'should set the logLevel': function (done) {
      sync.setLogLevel('my-dataset', {
        logLevel: 10
      }, function (err) {
        var args = stubs[STUB_NAMES.SYNC_UTIL].setLogger.getCall(0).args;

        expect(err).to.be.null;
        expect(args).to.deep.equal([
          'my-dataset',
          {
            logLevel: 10
          }
        ]);
        done();
      });
    }
  }
}
