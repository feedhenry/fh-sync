# fh-sync cloud

Node.js and express.js based mobile app data synchronization library. 

*Note* WIP. This repo targets to decouple fh-sync from other API's in fh-mbaas-api package.
For official and supported version of fh-sync please refer to fh-mbaas-api npm package.

## Usage
 fh-sync  is included as standard with your cloud app code.

```
npm install --save fh-sync-cloud
```

This will install the latest version of fh-sync-cloud and save the installed version in your package.json

## Documentation
Documentation for the fh-sync-cloud API is maintained at the [FeedHenry API Docs.](http://docs.feedhenry.com/v3/api/cloud_api.html)


## Tests
In order to run the tests, please make sure you have [Docker](https://www.docker.com/) installed.

Before running tests do:

```
npm install
npm install -g grunt-cli
```

Then to run the tests use ```npm test```

## Caveats

### Two sync loops per sync frequency
Two sync loops may be invoked per sync frequency if the server-side sync frequency
differs from the client-side frequency.

This is because the client and server sync frequencies are set independently.
Setting a long frequency on a client does not change the sync frequency on the
server.

The `syncFrequency` value of the dataset on the server should be set to the
`sync_frequency` value of the corresponding dataset on the client to avoid this.

For example:
  * `sync_frequency` on the client-side dataset is also set to 120 seconds.
  * `syncFrequency` on the server-side dataset is set to 120 seconds.

## API logging

Users of the fh-mbaas-api can then enable logging if they would like to see more output. This is useful for debugging purposes.
It's possible to pass environment variables to enable the logging according the rules specified for [debug](https://www.npmjs.com/package/debug) module:
  
```
DEBUG="fh-mbaas-api:*" ./yourscript 
```
If `DEBUG_COLORS=0` is passed also it will print log messages with proper timestamps. This is automatically enabled outside properly supported terminal.
