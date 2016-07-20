// Copyright (c) FeedHenry 2011
var util = require('util'),
dataHandler = require('./fixtures/syncHandler');
var syncParams = {
  "fn": "sync",
  "dataset_id": "myShoppingList",
  "query_params": {},
  "pending": []
};
var logParams = {
  "fn": "setLogLevel",
  "logLevel" : "error"
};
var dataset_id = "myShoppingList";

var $fh, ditchMock;

var assert = require('assert');

module.exports = {
  setUp : function(finish){
    ditchMock = require('./fixtures/sync_db');
    $fh = require("../lib/api.js");

    $fh.sync.init(dataset_id, {}, function() {
      $fh.sync.handleList(dataset_id, dataHandler.doList);
      $fh.sync.handleCreate(dataset_id, dataHandler.doCreate);
      $fh.sync.handleRead(dataset_id, dataHandler.doRead);
      $fh.sync.handleUpdate(dataset_id, dataHandler.doUpdate);
      $fh.sync.handleDelete(dataset_id, dataHandler.doDelete);
      $fh.sync.handleCollision(dataset_id, dataHandler.doCollision);
      $fh.sync.listCollisions(dataset_id, dataHandler.listCollisions);
      $fh.sync.removeCollision(dataset_id, dataHandler.removeCollision);
      finish();
    });
  },

  'test sync start & stop' : function(finish) {

    $fh.sync.invoke('myShoppingList', logParams, function(err, res){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(res.status);
      assert.equal("ok", res.status, "Unexpected response: " + util.inspect(res));
      finish();
    });
  },

  'test sync' : function(finish) {
    $fh.sync.invoke('myShoppingList', syncParams, function(err, res){
      console.log("sync res", err, res);
      assert.ok(!err, 'Error: ' + err);
      assert.ok(res);
      assert.ok(res.records);
      finish();
    });
  },

  'tearDown' : function(finish){
    $fh.shutdown(function(err, res){
      console.log("stopAll returned", err, res);
      assert.ok(!err, 'Error: ' + err);
      assert.ok(res);
      ditchMock.done();
      finish();
    });
   
  }
};
