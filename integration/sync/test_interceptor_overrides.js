var assert = require('assert');
var sync = require('../../lib/sync');

module.exports = {
  'test interceptor overrides': {
    'after': function(done) {
      sync.api.stopAll(done);
    },
    
  }
};