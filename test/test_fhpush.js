'use strict';

var proxyquire = require('proxyquire')
  , expect = require('chai').expect
  , sinon = require('sinon');

describe('$fh.push', function () {

  var mod, stubs, validCfg, senderStub, utilStubs;

  var STUB_MAP = {
    FHUTIL: './fhutils',
    UPS: 'unifiedpush-node-sender'
  };

  beforeEach(function () {
    // Each test should start with fresh copies of deps
    require('clear-require').all();

    senderStub = {
      send: sinon.stub()
    };

    validCfg = {
      fhapi: {
        widget: 'a',
        instance: 'b',
        millicore: 'fake-domain.feedhenry.com',
        port: 4567
      }
    };

    utilStubs = {
      getMillicoreProps: sinon.stub().returns(validCfg.fhapi),
      addAppApiKeyHeader: sinon.stub()
    };

    stubs = {};

    stubs[STUB_MAP.UPS] = {
      Sender: sinon.stub().returns(senderStub)
    };

    stubs[STUB_MAP.FHUTIL] = sinon.stub().returns(utilStubs);

    mod = proxyquire('lib/push', stubs);
  });

  describe('#push', function () {
    it('should return a function', function () {
      expect(mod(validCfg)).to.be.a('function');
      expect(utilStubs.getMillicoreProps.callCount).to.equal(1);
      expect(utilStubs.addAppApiKeyHeader.callCount).to.equal(1);
      expect(stubs[STUB_MAP.UPS].Sender.callCount).to.equal(0);
    });

    it('should return an error - missing "messsage"', function (done) {
      mod(validCfg)(null, null, function (err) {
        expect(err).to.exist;
        expect(err.toString()).to.contain(
          'Missing required \'message\' parameter'
        );

        done();
      });
    });

    it('should return an error - missing "options"', function (done) {
      mod(validCfg)({ alert: 'fáilte!' }, null, function (err) {
        expect(err).to.exist;
        expect(err.toString()).to.contain(
          'Missing required \'options\' parameter'
        );

        done();
      });
    });

    it('should return an error - missing "options.app"', function (done) {
      mod(validCfg)({ alert: 'slán' }, {}, function (err) {
        expect(err).to.exist;
        expect(err.toString()).to.contain(
          'Missing required \'options.apps\' parameter'
        );

        done();
      });
    });

    it('should send a push payload to the AeroGear.Sender', function (done) {
      senderStub.send.yields(null);

      var message = { alert: 'go raibh maith agat' };
      var options = { broadcast: true };

      expect(stubs[STUB_MAP.UPS].Sender.callCount).to.equal(0);

      mod(validCfg)(message, options, function (err) {
        expect(err).to.not.exist;
        expect(senderStub.send.getCall(0).args[0]).to.deep.equal(message);
        expect(senderStub.send.getCall(0).args[1]).to.deep.equal(options);

        // Sender should be constructed only upon a call - lazy load
        expect(stubs[STUB_MAP.UPS].Sender.callCount).to.equal(1);

        done();
      });
    });
  });

  describe('#getPushClient', function () {
    it('should return a push function using custom options', function (done) {
      senderStub.send.yields(null);

      var fhpush = mod(validCfg);

      var customOpts = {
        widget: '123',
        instance: '321',
        appapikey: 'abc'
      };

      var customPush = fhpush.getPushClient(customOpts);

      var message = { alert: 'go raibh maith agat' };
      var options = { broadcast: true };

      expect(customPush).to.be.a('function');
      expect(customPush).to.not.equal(fhpush); // should be a new instance

      // This should only ever be called on the first creation
      expect(utilStubs.getMillicoreProps.callCount).to.equal(1);

      // Called each time we create a sender
      expect(utilStubs.addAppApiKeyHeader.callCount).to.equal(2);

      // Send a push using the custom sender
      customPush(message, options, function (err) {
        expect(err).to.not.exist;

        // Verify our custom options are being used
        var senderSettings = stubs[STUB_MAP.UPS].Sender.getCall(0).args[0];

        // Should have used our custom options
        expect(senderSettings).to.deep.equal({
          url: 'https://fake-domain.feedhenry.com:4567/box/api/unifiedpush/mbaas/',
          applicationId: 'fake',
          masterSecret: 'fake',
          headers: {
            'X-Project-Id': customOpts.widget,
            'X-App-Id': customOpts.instance
          }
        });

        done();
      });

    });
  });
});
