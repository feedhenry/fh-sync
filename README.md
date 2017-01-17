#Overview

[![npm package](https://nodei.co/npm/fh-mbaas-api.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/fh-mbaas-api/)

[![Build status](https://img.shields.io/travis/feedhenry/fh-mbaas-api/master.svg?style=flat-square)](https://travis-ci.org/feedhenry/fh-mbaas-api)
[![Dependency Status](https://img.shields.io/david/feedhenry/fh-mbaas-api.svg?style=flat-square)](https://david-dm.org/feedhenry/fh-mbaas-api)
[![Known Vulnerabilities](https://snyk.io/test/npm/fh-mbaas-api/badge.svg?style=flat-square)](https://snyk.io/test/npm/fh-mbaas-api)


fh-mbaas-api provides FeedHenry MBaaS APIs to Node.js cloud apps.

|                 | Project Info  |
| --------------- | ------------- |
| License:        | Apache License, Version 2.0  |
| Build:          | npm  |
| Documentation:  | http://docs.feedhenry.com/v3/api/cloud_api.html  |
| Issue tracker:  | https://issues.jboss.org/projects/FH/summary  |
| Mailing list:   | [feedhenry-dev](https://www.redhat.com/archives/feedhenry-dev/) ([subscribe](https://www.redhat.com/mailman/listinfo/feedhenry-dev))  |
| IRC:            | [#feedhenry](https://webchat.freenode.net/?channels=feedhenry) channel in the [freenode](http://freenode.net/) network.  |

#Usage
fh-mbaas-api is included as standard with your cloud app code.

For custom apps, add the module via npm by running the following for the root of your app

```
npm install --save fh-mbaas-api
```

This will install the latest version of fh-mbaas-api and save the installed version in your package.json

#Documentation
Documentation for the $fh cloud API is maintained at the [FeedHenry API Docs.](http://docs.feedhenry.com/v3/api/cloud_api.html)

#Deprecated
Legacy Rhino functions have been deprecated. These are listed below - with their replacements **in bold**. All replacements listed but '$fh.web' have drop-in replacements available.  

* $fh.web -> **[request](https://github.com/mikeal/request)**
* $fh.log -> **console.log**
* $fh.parse -> **JSON.parse**
* $fh.stringify  **JSON.stringify**

#Tests
Before running tests do:

```
npm install
npm install -g grunt-cli
```

Then to run the tests use ```npm test```

On Windows, use ```npm run testwindows```

If tests return session errors in relation to redis, like the following:

```
1)  test session no timeout:

      Uncaught AssertionError: Error: Error: Ready check failed: ERR operation not permitted
      + expected - actual
```

Ensure that the correct redis password is set - `export FH_REDIS_PASSWORD=RedisPassword`

# Caveats

## Two sync loops per sync frequency
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
