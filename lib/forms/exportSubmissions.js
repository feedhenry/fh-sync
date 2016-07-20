var mbaasClient = require('fh-mbaas-client');

module.exports = function (config) {
  return {
    exportCSV: function (options, cb) {
      mbaasClient.app.submissions.exportCSV({
        environment: config.fhmbaas.environment,
        domain: config.fhmbaas.domain,
        queryParams: {
          projectId : options.projectId,
          submissionId: options.submissionId,
          formId: options.formId,
          fieldHeader: options.fieldHeader
        }
      }, cb);
    },
    exportSinglePDF: function (options, cb) {
      mbaasClient.app.submissions.exportSinglePDF({
        environment: config.fhmbaas.environment,
        domain: config.fhmbaas.domain,
        id: options.submissionId
      }, cb);
    }
  };
};
