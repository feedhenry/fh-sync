var stream = require('stream');
var util = require('util');

//Handy writable stream to test with
function MockReadStream () { // step 2
  stream.Readable.call(this);
  this.isCalled = false;
}

util.inherits(MockReadStream, stream.Readable); // step 1

//Mock read stream that emits "something" then ends.
MockReadStream.prototype._read = function () { // step 3
  if(!this.isCalled){
    this.isCalled = true;
    this.push("Something");
  } else {
    this.push(null);
  }
};

module.exports = MockReadStream;