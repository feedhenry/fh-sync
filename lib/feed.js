var assert = require('assert'),
  millicall, cfg;

//
// $fh.feed()
// Same interface as http://docs.feedhenry.com/wiki/Read_Rss_Feed
//

module.exports = function (config) {
  assert.ok(config, 'cfg is undefined');
  cfg = config;
  millicall = require('./call')(config);
  return cachedFeedReader;
};

var cachedFeedReader = function feed(params, callback) {
  if (!callback) {
    throw new Error('callback undefined in $fh.feed. See documentation of $fh.feed for proper usage');
  }
  millicall('ent/feed/Feed/get_entries', params, callback);
};
