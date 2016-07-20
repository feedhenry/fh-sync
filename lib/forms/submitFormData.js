var mbaasClient = require('fh-mbaas-client');

module.exports = function(forms, config){
  return function submitFormData(options, cb) {
    options.submission = options.submission || {};
    options.submission.appCloudName = config.fhapi.appname;
    options.submission.appClientId = options.appClientId;

    mbaasClient.app.forms.submitFormData({
      environment: config.fhmbaas.environment,
      domain: config.fhmbaas.domain,
      id: options.submission.formId,
      submission: options.submission
    }, function (err, submissionResult) {
      if (err) {
        forms.emit('submissionError', {
          type: 'jsonError',
          error: err
        });
        return cb(err);
      }

      //If the submission is not valid, then emit the submissionError Event
      if(submissionResult.error && !submissionResult.error.valid) {
        forms.emit('submissionError', {
          type: 'validationError',
          error: submissionResult.error
        });
        return cb(submissionResult.error);
      }

      forms.emit('submissionStarted', submissionResult);
      return cb(undefined, submissionResult);
    });
  };
};