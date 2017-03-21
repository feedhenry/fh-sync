var _ = require('underscore');

module.exports = function(grunt) {
  'use strict';

  function makeTestArgs(testFile) {
    return ['-u exports --recursive -t 10000 ./test/setup.js', testFile].join(' ');
  }

  function makeUnits(testArgString) {
    return [test_runner, testArgString].join(' ');
  }

  function makeUnitCovers(testArgString) {
    return ['istanbul cover --dir cov-unit', test_runner, '--', testArgString].join(' ');
  }

  // TODO: move these to use the grunt-mocha-test plugin

  var tests = [    /* If updating this list of tests, also update test_win.cmd for Windows */
    './test/test_fhutils.js',
    './test/test_fhact.js',
    './test/test_fhdb.js',
    './test/test_fhforms.js',
    './test/test_fhsec.js',
    './test/test_fhsession.js',
    './test/test_fhstat.js',
    './test/test_cache.js',
    './test/test_redis.js',
    './test/test_fhauth.js',
    './test/test_init.js',
    './test/test_log.js',
    './test/test_fhpush.js',
    './test/sync/test_mongodbQueue.js',
    './test/sync/test_index.js',
    './test/sync/test_worker.js',
    './test/sync/test_sync-processor.js',
    './test/sync/test_sync-scheduler.js',
    './test/sync/test_ack-processor.js',
    './test/sync/test_pending-processor.js',
    './test/sync/test_hashProvider.js',
    './test/sync/test_api-sync.js',
    './test/sync/test_dataHandlers.js',
    './test/sync/test_api-syncRecords.js',
    './test/sync/test_default-dataHandlers.js',
    './test/sync/test_interceptors.js',
    './test/sync/test_lock.js',
    './test/sync/test_datasetClientsCleaner.js',
    './test/sync/test_sync-metrics.js'
  ];
  var unit_args = _.map(tests, makeTestArgs);
  var test_runner = '_mocha';

  // Just set shell commands for running different types of tests
  grunt.initConfig({
    mochaTest: {
      integration: {
        options: {
          ui: 'exports',
          reporter: 'spec',
          timeout: 30000
        },
        src: ['integration/**/test*.js']
      }
    },

    // These are the properties that grunt-fh-build will use
    unit: _.map(unit_args, makeUnits),
    unit_cover: _.map(unit_args, makeUnitCovers)
  });

  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-fh-build');
  grunt.registerTask('default', ['fh:default']);
};
