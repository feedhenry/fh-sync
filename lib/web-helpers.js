var crypto = require('crypto');
var url = require('url');

//
// Converts existing existing $fh.web() options (as documented here: http://docs.feedhenry.com/wiki/Web_Requests) to node.js http.request options (as documented here: http://nodejs.org/docs/v0.4.7/api/all.html#http.request)
//
function convertFHOptionsToNodeOptions(fhOptions) {
  var nodeOptions = {};
  if (fhOptions.url) {
    var u = url.parse(fhOptions.url);
    nodeOptions.host = u.hostname;
    nodeOptions.port = u.port;
    if (u.search)
      nodeOptions.path = u.pathname + u.search;
    else
      nodeOptions.path = u.pathname;

    nodeOptions.isSecure = u.protocol === 'https:';
  }

  if (fhOptions.method) {
    nodeOptions.method = fhOptions.method;
  } else {
    nodeOptions.method = "GET";
  }

  if (fhOptions.contentType) {
    nodeOptions.headers = {};
    nodeOptions.headers['content-type'] = fhOptions.contentType;
  }

  // Convert FH Headers array into Node headers
  if (fhOptions.headers) {
    if (!nodeOptions.headers) {
      nodeOptions.headers = {};
    }
    for (var i = 0; i < fhOptions.headers.length; i++) {
      nodeOptions.headers[fhOptions.headers[i].name] = fhOptions.headers[i].value;
    }
  }

  // Convert FH cookie array into node header cookie
  if (fhOptions.cookies) {
    if (!nodeOptions.headers) {
      nodeOptions.headers = {};
    }
    var cookies = "";
    for (var j = 0; j < fhOptions.cookies.length; j++) {
      cookies += fhOptions.cookies[j].name + '=' + fhOptions.cookies[j].value + ';';
    }

    nodeOptions.headers['Cookie'] = cookies;
  }

  return nodeOptions;
}

function webCacheKey(fhOptions) {
  var hashText = JSON.stringify(fhOptions);
  return crypto.createHash('md5').update(hashText).digest('hex');
}

exports.convertFHOptionsToNodeOptions = convertFHOptionsToNodeOptions;
exports.webCacheKey = webCacheKey;
