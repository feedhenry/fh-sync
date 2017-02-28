var interceptorsModule = require('../../lib/sync/interceptors');
var interceptors = interceptorsModule();
var assert = require('assert');
var sinon = require('sinon');

var DATASETID = "testInterceptors";
module.exports = {
  'test default request interceptors': function(done) {
    var callback = sinon.spy();
    interceptors.requestInterceptor(DATASETID, {}, callback);
    assert.ok(callback.calledOnce);
    done();
  },
  'test default response interceptor': function(done) {
    var callback = sinon.spy();
    interceptors.responseInterceptor(DATASETID, {}, callback);
    assert.ok(callback.calledOnce);
    done();
  },
  'test override default request interceptors': function(done) {
    var requestCalled = false;
    interceptors.setDefaultRequestInterceptor(function(datasetid, params, callback){
      requestCalled = true;
      callback();
    });
    interceptors.requestInterceptor(DATASETID, {}, function(){
      assert.ok(requestCalled);
      done();
    });
  },
  'test override default response interceptors': function(done) {
    var responseCalled = false;
    interceptors.setDefaultResponseInterceptor(function(datasetid, params, callback){
      responseCalled = true;
      callback();
    });
    interceptors.responseInterceptor(DATASETID, {}, function(){
      assert.ok(responseCalled);
      done();
    });
  },
  'test override request interceptor for dataset': function(done) {
    var datasetRequestCalled = false;
    interceptors.setRequestInterceptor(DATASETID, function(dataset, params, callback){
      datasetRequestCalled = true;
      callback();
    });
    interceptors.requestInterceptor(DATASETID, {}, function(){
      assert.ok(datasetRequestCalled);
      done();
    });
  },
  'test override response interceptor for dataset': function(done) {
    var datasetResponseCalled = false;
    interceptors.setResponseInterceptor(DATASETID, function(dataset, params, callback){
      datasetResponseCalled = true;
      callback();
    });
    interceptors.responseInterceptor(DATASETID, {}, function(){
      assert.ok(datasetResponseCalled);
      done();
    });
  }
};