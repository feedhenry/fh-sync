var stream = require('stream');
var util = require('util');


//Handy writable stream to test with
function MockWriteStream () { // step 2
  stream.Writable.call(this);
}

util.inherits(MockWriteStream, stream.Writable); // step 1

MockWriteStream.prototype._write = function (chunk, encoding, done) { // step 3
  done();
};

module.exports = MockWriteStream;