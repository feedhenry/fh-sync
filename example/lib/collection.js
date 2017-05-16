var mongodb = require('mongodb');

// Seed a collection with replicas of an object, used for benchmarking.
function seedCollection(req, res) {
  var collectionName = req.body.collectionName || 'myShoppingList';
  var seedSize = req.body.seedSize || 1;
  var seedData = req.body.seedData || { test: 'test' };
  var seedList = [];
  // TODO: Why was `_.fill` causing issues with duplicate objects?
  for (var i = 0; i < seedSize; i++) {
    seedList.push(clone(seedData));
  }
  mongodb.connect(process.env.FH_MONGODB_CONN_URL, function(err, db) {
    db.collection(collectionName).insertMany(seedList, function(err, data) {
      if(err) {
        return res.json({error: err}).status(500);
      }
      return res.json({message: 'Collection successfully seeded'}).status(200);
    });
  });
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = {
  seed: seedCollection
}