var util = require('util');
var $fh = require("../lib/api.js");
var text = 'This is test text';
var assert = require('assert');

module.exports = {
  'test keygen with no keysize': function(finish){
    $fh.sec({act:'keygen', params: {algorithm:'AES'}}, function(err, result){
      assert.ok(err);
      finish();
    });
  },
  'test keygen AES': function(finish){
    $fh.sec({act:'keygen', params:{algorithm: 'AES', keysize: 128}}, function(err, result){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(result.secretkey);
      assert.ok(result.iv);
      finish();
    });
  },
  'test keygen RSA': function(finish){
    $fh.sec({act:'keygen', params:{algorithm:'RSA', keysize: 1024}}, function(err, result){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(result.public);
      assert.ok(result.private);
      assert.ok(result.modulu);
      finish();
    });
  },
  'test keygen with no params' : function(finish){
    $fh.sec({act:'keygen'}, function(err, result){
      assert.ok(err);
      finish();
    });
  },
  'test aes encrypt/decrypt': function(finish){
    var plaintext = 'This is test text';
    $fh.sec({act:'keygen', params:{algorithm: 'AES', keysize: 128}}, function(err, result){
      $fh.sec({act:'encrypt', params:{algorithm:'AES', key: result.secretkey, iv: result.iv, plaintext:plaintext}}, function(e, r){
        assert.ok(!e);
        var ciphertext = r.ciphertext;
        $fh.sec({act:'decrypt', params:{algorithm:'AES', key: result.secretkey, iv: result.iv, ciphertext:ciphertext}}, function(de, dr){
          assert.equal(dr.plaintext, plaintext);
          finish();
        });
      });
    });
  },
  'test aes encrypt with missing params' : function(finish){
    $fh.sec({act:'encrypt', params:{algorithm:'AES'}}, function(err, result){
      assert.ok(err);
      finish();
    });
  },
  'test rsa encrypt/decrypt': function(finish){
    var plaintext = 'This is test text';
    $fh.sec({act:'keygen', params:{algorithm:'RSA', keysize: 1024}}, function(err, result){
      assert.ok(!err, 'Error: ' + err);
      $fh.sec({act:'encrypt', params:{algorithm:'RSA', plaintext:plaintext, public: result.public}}, function(e, r){
        assert.ok(!e);
        $fh.sec({act:'decrypt', params:{algorithm:'RSA', ciphertext:r.ciphertext, private: result.private}}, function(de, dr){
          assert.ok(!de);
          assert.equal(plaintext, dr.plaintext);
          finish();
        });
      });
    });
  },
  'test hashing md5': function(finish){
    $fh.hash({algorithm:'md5', text: text}, function(err, result){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(result.hashvalue);
      finish();
    });
  },
  'test hashing sha1': function(finish){
    $fh.hash({algorithm:'sha1', text: text}, function(err, result){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(result.hashvalue);
      finish();
    });
  },
  'test hashing sha256': function(finish){
    $fh.hash({algorithm:'sha256', text: text}, function(err, result){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(result.hashvalue);
      finish();
    });
  },
  'test hashing sha512': function(finish){
    $fh.hash({algorithm:'sha512', text: text}, function(err, result){
      assert.ok(!err, 'Error: ' + err);
      assert.ok(result.hashvalue);
      finish();
    });

  }
}