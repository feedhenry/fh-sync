# fh-sync

Node.js implementation of the FeedHenry Data Syncronisation Server.
To be used in conjunction with the [FeedHenry Data Syncronisation Client](https://github.com/feedhenry/fh-sync-js).

## Dependencies

You will need a local Mongodb server and Redis server. For information on setting up these

Mongodb see

https://docs.mongodb.com/manual/installation/

Redis see

https://redis.io/topics/quickstart


## Running on Openshift

The simplest way to run sync server on Openshift is to use [Feedhenry Sync Server](https://github.com/feedhenry/fh-sync-server). It includes Openshift template that sets up Redis and Mongo, and creates the running sync server instance. It is also possible to use the repository for running sync server locally.

## Example Server

To run the example server start MongoDB and Redis locally on their default ports
then issue the following commands in this repository:

```
cd examples/basic-express-example/
npm install
node server.js
```

When the server has started try making the following cURL request:

```
curl http://localhost:3000/sync/messages -X POST --data '{"fn": "syncRecords"}' -H "content-type:application/json"
```

## Usage

```
npm install --save fh-sync
```

This will install the latest version of fh-sync and save the installed version in your package.json

To use sync in your application, require it and call `connect`.

```js
var sync = require('fh-sync');

var mongodbConnectionString = 'mongodb://127.0.0.1:27017/sync';
var redisUrl = 'redis://127.0.0.1:6379';

sync.api.connect(mongodbConnectionString, {}, redisUrl, function(){});
```

To configure a dataset for syncing, wait for the `sync:ready` event, then `init` the dataset.

```js
sync.api.getEventEmitter().on('sync:ready', function() {
  console.log('sync ready');

  sync.api.init('myDataset', {
    syncFrequency: 10 // seconds
  }, function() {});
});
```
## Documentation

See [Documentation folder](./docs)

## Tests
In order to run the tests, please make sure you have [Docker](https://www.docker.com/) installed.

Before running tests do:

```
npm install
npm install -g grunt-cli
```

Then to run the tests use ```npm test```

## Cordova client template

The [Feedhenry Cordova Sync Template](https://github.com/feedhenry-templates/feedhenry-cordova-sync-app) can be used to create client application talking to the sync server.


