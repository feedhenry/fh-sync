var _ = require('underscore');

module.exports = function(grunt) {
  'use strict';

  function makeTestArgs(testFile) {
    return ['-u exports --recursive -t 10000 ', testFile].join(' ');
  }

  function makeUnits(testArgString) {
    return [test_runner, testArgString].join(' ');
  }

  function makeUnitCovers(testArgString) {
    return ['istanbul cover --dir cov-unit', test_runner, '--', testArgString].join(' ');
  }

  // TODO: move these to use the grunt-mocha-test plugin

  var tests = [    /* If updating this list of tests, also update test_win.cmd for Windows */
    './test/test_mongodbQueue.js',
    './test/test_index.js',
    './test/test_worker.js',
    './test/test_sync-processor.js',
    './test/test_sync-scheduler.js',
    './test/test_ack-processor.js',
    './test/test_pending-processor.js',
    './test/test_hashProvider.js',
    './test/test_api-sync.js',
    './test/test_dataHandlers.js',
    './test/test_api-syncRecords.js',
    './test/test_default-dataHandlers.js',
    './test/test_interceptors.js',
    './test/test_lock.js',
    './test/test_datasetClientsCleaner.js',
    './test/test_sync-metrics.js'
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
