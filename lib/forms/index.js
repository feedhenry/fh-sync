var assert = require('assert'),
  futils = require('./../fhutils'),
  mbaasClient = require('fh-mbaas-client'),
  async = require('async'),
  _ = require('underscore'),
  fs = require('fs'),
  exportSubmissions = require("./exportSubmissions"),
  logger,
  appname,
  config,
  fhutils,
  forms,
  exportCSVandPDF;

var util = require('util');
var events = require("events");

//Requires appId to be specified -- appId === FH_WIDGET
//Full dynofarm app name === FH_APPNAME
//Env === FH_ENV
//mbaas client is initialised in api.js
var getForms = function (options, cb) {
  mbaasClient.app.forms.list({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain
  }, function (err, formsArray) {
    return cb(err, {forms: formsArray});
  });
};

var getForm = function (options, cb) {
  mbaasClient.app.forms.get({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain,
    id: options._id
  }, cb);
};

//Requires appId
var getTheme = function (options, cb) {
  mbaasClient.app.themes.get({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain
  }, cb);
};

//Requires appId
var getAppClientConfig = function (options, cb) {
  mbaasClient.app.formsConfig.get({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain
  }, function (err, config) {
    if (err) {
      return cb(err);
    }
    var clientConfig = config.client;

    var config_admin_user = false;
    if (options.deviceId && clientConfig.config_admin_user && (clientConfig.config_admin_user.length > 0)) {
      config_admin_user = deviceInClientAdminUserList(options.deviceId, clientConfig.config_admin_user);
    }
    clientConfig.config_admin_user = config_admin_user;
    return cb(undefined, clientConfig);

    function deviceInClientAdminUserList(deviceId, deviceList) {
      return deviceList.indexOf(deviceId) >= 0;
    }
  });
};

var submitFormFile = function (options, cb) {
  var submissionOptions = options.submission;

  //Checking for no file path passed. Expected to be a string.
  var isString = (typeof submissionOptions.fileStream === "string");
  if (!isString) {
    return cb(new Error("No File Path Passed"));
  }

  var filePath = submissionOptions.fileStream || "";

  var fileName = filePath.split('/');
  fileName = fileName[fileName.length - 1];

  //Checking if the file exists.

  fs.stat(filePath, function (err, stats) {
    if (err) {
      return cb(new Error("File At Path " + filePath + " does not exist"));
    }
    var fileDetails = {
      name: fileName,
      size: stats.size,
      type: 'application/octet-stream',
      stream: fs.createReadStream(filePath)
    };

    var fileRequestParams = {
      environment: config.fhmbaas.environment,
      domain: config.fhmbaas.domain,
      id: submissionOptions.submissionId,
      fieldId: submissionOptions.fieldId,
      fileId: submissionOptions.fileId,
      fileDetails: fileDetails
    };

    function _handleUploadResponse(err, uploadResponse){
      if(err){
        forms.emit('submissionError', {
          type: 'fileUploadError',
          submissionId: submissionOptions.submissionId,
          fileName: fileName,
          error: err
        });
      }

      return cb(err, uploadResponse);
    }

    if (submissionOptions.decodeBase64) {
      mbaasClient.app.submissions.uploadFileBase64(fileRequestParams, _handleUploadResponse);
    } else {
      mbaasClient.app.submissions.uploadFile(fileRequestParams, _handleUploadResponse);
    }
  });

};

var getSubmissionStatus = function (options, cb) {
  mbaasClient.app.submissions.status({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain,
    id: options.submission.submissionId
  }, cb);
};

var completeSubmission = function (options, cb) {
  mbaasClient.app.submissions.complete({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain,
    id: options.submission.submissionId
  }, function (err, completionResult) {
    if (err) {
      return cb(err);
    }

    var eventResult = {
      submissionId: completionResult.formSubmission._id,
      submissionCompletedTimestamp: completionResult.formSubmission.submissionCompletedTimestamp,
      submission: completionResult.formSubmission
    };

    forms.emit('submissionComplete', eventResult);
    return cb(undefined, completionResult);
  });
};

var getFullyPopulatedForms = function (options, cb) {
  mbaasClient.app.forms.search({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain,
    searchParams: options.formids
  }, cb);
};

var getSubmissions = function (params, cb) {
  mbaasClient.app.submissions.search({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain,
    searchParams: params
  }, function (err, submissions) {
    submissions = submissions || [];

    return cb(err, {submissions: submissions});
  });
};

var getSubmission = function (options, cb) {
  mbaasClient.app.submissions.get({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain,
    id: options.submissionId
  }, cb);
};

var getSubmissionFile = function (options, cb) {
  mbaasClient.app.submissions.getFile({
    environment: config.fhmbaas.environment,
    domain: config.fhmbaas.domain,
    fileId: options._id
  }, function (err, responseStream) {
    return cb(err, {
      stream: responseStream
    });
  });
};

/*
 A convenience object for preparing a submission for upload to the database.
 */
var Submission = function (params) {
  params = params || {};
  var self = this;
  self.form = params.form;
  //A flag for keeping files/not keeping files on the file system when they have been submitted.
  //Default is false
  self.keepFiles = params.keepFiles;

  /**
   * <<filePlaceHolderId>> : <<paused streamable>>
   */
  self.filesToUpload = {};

  /**
   * Values for each of the fields
   *
   * {
   *  <<field Id>>: [<<field Values>>]
   * }
   */
  self.fieldValues = {};

  //Base Submission Definition
  self.submissionData = {
    formId: params.formId,
    timezoneOffset: 0,
    deviceId: "NOT-SET",
    deviceIPAddress: "127.0.0.1",
    deviceFormTimestamp: self.form.lastUpdated,
    formFields: [],
    appClientId: config.fhapi.widget,
    comments: []
  };
};

/**
 * Add input value into a submission
 * @param params {fieldId: <<Id Of Field To Add To>>, fieldCode: <<Field Code of Field To Add To>>, value: <<value to input data into>>, stream: <<Readable stream to save.>>}
 *
 * @returns error <<If there is an error adding the input, an error is returned>>
 */
Submission.prototype.addFieldInput = function (params) {
  var self = this;
  var field;

  //Finding the JSON definition of a field to add data to.
  function findFieldDefinition() {
    var foundField;
    if (!(params.fieldId || params.fieldCode)) {
      return undefined;
    }

    //Iterating through each of the pages to find a matching field.
    _.each(self.form.pages, function (page) {
      _.each(page.fields, function (field) {
        var fieldId = field._id;
        var fieldCode = field.fieldCode;

        if (fieldId === params.fieldId || fieldCode === params.fieldCode) {
          foundField = field;
        }
      });
    });

    return foundField;
  }

  /**
   * Adding a value to an index.
   * Most inputs are validated by the rules engine, but file inputs need to be a file location on the local app.
   * It is advisible to download the file to local storage first.
   * @returns {error/undefined}
   */
  function processInputValue() {
    var value = params.value;
    var index = params.index || 0;
    var fieldType = field.type;

    //Checking for a value.
    if (typeof(value) === "undefined" || value === null) {
      return "No value entered.";
    }

    /**
     * File-base fields (photo, signature and file) need to stream the file to the mongo server.
     */
    if (fieldType === "photo" || fieldType === "signature" || fieldType === "file") {
      //The stream must be a paused stream.
      var fileURI = value.fileStream;

      delete value.fileStream;

      //It must be possible to stream the object to the database.
      var isString=(typeof(fileURI) === "string");
      if (!isString) {
        return "Expected a string URI object when streaming a file-based field ";
      }

      if (!(value.fileName && value.fileSize && value.fileType)) {
        return "Invalid file parameters. Params: " + JSON.stringify(value);
      }

      //Generating a random file hash name.
      var hashName = "filePlaceHolder" + Date.now() + Math.floor(Math.random() * 10000000000000);
      var fileUpdateTime = Date.now;

      self.filesToUpload[hashName] = {
        fieldId: field._id,
        fileStream: fileURI
      };

      value.hashName = hashName;
      value.fileUpdateTime = fileUpdateTime;
    }

    self.fieldValues[field._id] = self.fieldValues[field._id] || [];
    self.fieldValues[field._id][index] = value;
    return undefined;
  }

  if (!self.form) {
    return "No form definition assigned to this submission";
  }

  field = findFieldDefinition();

  if (!field) {
    return "No field found. Params: " + JSON.stringify(params);
  }

  var inputProcessError = processInputValue();

  if (inputProcessError) {
    return inputProcessError;
  }

  return undefined;
};

/**
 * Submitting the form data and any files associated with the submission
 * @returns {*}
 */
Submission.prototype.submit = function (cb) {
  var self = this;

  self.submissionData.formFields = _.map(self.fieldValues, function (valuesArray, fieldId) {
    valuesArray = _.filter(valuesArray, function (value) {
      return typeof(value) !== undefined && value !== null;
    });

    return {
      fieldId: fieldId,
      fieldValues: valuesArray
    };
  });

  //Now ready to submit form data.
  forms.submitFormData({
    submission: self.submissionData,
    appClientId: self.submissionData.appClientId
  }, function (err, result) {
    if (err || result.error) {
      return cb(err || result.error);
    }

    self.submissionId = result.submissionId;

    var hashNames = Object.keys(self.filesToUpload);

    /**
     * Uploading any files that were part of the submission.
     */
    async.eachSeries(hashNames, function (hashName, cb) {
      var fileData = self.filesToUpload[hashName];
      submitFormFile({
        submission: {
          fileId: hashName,
          submissionId: self.submissionId,
          fieldId: fileData.fieldId,
          fileStream: fileData.fileStream,
          keepFile: self.keepFiles
        }
      }, cb);
    }, function (err) {
      //Returning the remote submission Id when finished.
      if (err) {
        return cb(err);
      }

      completeSubmission({submission: {submissionId: self.submissionId}}, function (err, completeStatus) {
        if (err || completeStatus.status !== "complete") {
          return cb(err || "Complete Submission Failed");
        }

        return cb(undefined, self.submissionId);
      });
    });
  });
};

/**
 * Creating a submission model for use with the $fh.forms Cloud API
 * @param options {formId: <<Id of the form to create a submission for>>}
 * @param cb
 */
var createSubmissionModel = function (options, cb) {
  var form = options.form;

  //The submission needs to be initialised with a form.
  if (!form) {
    return cb("No form entered.");
  }

  return cb(undefined, new Submission({form: form, formId: form._id}));
};

function Forms() {
  var self = this;
  events.EventEmitter.call(this);

  this.formEventListeners = [];
  this.getForms = getForms;
  this.getForm = getForm;
  this.getPopulatedFormList = getFullyPopulatedForms;
  this.getTheme = getTheme;
  this.getAppClientConfig = getAppClientConfig;
  this.submitFormData = require('./submitFormData')(self, config);
  this.createSubmissionModel = createSubmissionModel;
  this.submitFormFile = submitFormFile;
  this.getSubmissionStatus = getSubmissionStatus;
  this.completeSubmission = completeSubmission;
  this.getSubmissions = getSubmissions;
  this.getSubmission = getSubmission;
  this.getSubmissionFile = getSubmissionFile;
  this.exportCSV = exportCSVandPDF.exportCSV;
  this.exportSinglePDF = exportCSVandPDF.exportSinglePDF;
  this.registerListener = function (listener, cb) {
    if (!(listener instanceof events.EventEmitter)) {
      return cb(new Error("registerListener: Listener Must Be an instance of EventEmitter."));
    }

    this.formEventListeners.push(listener);
    this.formEventListeners = _.uniq(this.formEventListeners);
    return cb();
  };

  this.deregisterListener = function (listener, cb) {
    if (!(listener instanceof events.EventEmitter)) {
      return cb(new Error("deregisterListener: Listener Must Be an instance of EventEmitter."));
    }

    this.formEventListeners = _.without(this.formEventListeners, listener);
    return cb();
  };

  this.emit = function (event, eventParams) {
    events.EventEmitter.prototype.emit.call(this, arguments);
    _.each(this.formEventListeners, function (formEventListener) {
      formEventListener.emit(event, eventParams);
    });
  };
}

module.exports = function (cfg) {
  assert.ok(cfg, 'cfg is undefined');
  config = cfg;
  logger = cfg.logger;
  appname = cfg.fhapi.appname;
  fhutils = new futils(config);
  util.inherits(Forms, events.EventEmitter);
  exportCSVandPDF = exportSubmissions(cfg);
  forms = new Forms();
  return forms;
};