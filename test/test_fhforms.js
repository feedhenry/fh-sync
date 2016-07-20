var proxyquire = require('proxyquire').noCallThru();
var mockMbaasClient = require('./fixtures/forms.js');
var assert = require('assert');
var events = require('events');
var sinon = require('sinon');
var stream = require('stream');

var testSubmission = {
  _id: "somesubmissionid",
  formId: "someFormId",
  formFields: []
};

module.exports = {
  'test getForms' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getForms({appClientId:'1234'}, function(err, res){
      assert.ok(!err);
      assert.ok(res);
      finish();
    });
  },
  'test getForm' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getForm({appClientId:'1234', "_id": "formId1234"}, function(err, res){
      assert.ok(!err);
      assert.ok(res);
      finish();
    });
  },
  'test getTheme' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getTheme({appClientId:'1234'}, function(err, res){
      assert.ok(!err);
      assert.ok(res);
      finish();
    });
  },
  'test submitFormData' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.submitFormData({appClientId:'1234', submission: testSubmission}, function(err, res){
      assert.ok(!err);
      assert.ok(res);
      finish();
    });
  },
  'test submitFormData with events' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    var submissionStartedEventCalled = false;
    var submissionCompleteEventCalled = false;

    var submissionEventListener = new events.EventEmitter();

    $fh.forms.registerListener(submissionEventListener, function(err){
      assert.ok(!err, "Expected no error when adding a submission event listener.");

      //Listening to submissionStarted events
      submissionEventListener.on('submissionStarted', function(submissionParams){
        assert.ok(!submissionStartedEventCalled, "Submission started event called twice");
        assert.ok(submissionParams, "Expected submission params to be passed to the submissionStarted evnet.");
        submissionStartedEventCalled=true;
      });

      //Listening to submissionComplete events
      submissionEventListener.on('submissionComplete', function(submissionParams){
        assert.ok(!submissionCompleteEventCalled, "Submission Complete event called twice");
        assert.ok(submissionParams, "Expected submission params to be passed to the submissionStarted evnet.");
        assert.ok(submissionParams.submissionId, "Expected A Submission Id");
        assert.ok(submissionParams.submissionCompletedTimestamp, "Expected A Submission Completed Timestamp");
        assert.ok(submissionParams.submission, "Expected A Submission");
        submissionCompleteEventCalled=true;
      });

      $fh.forms.submitFormData({appClientId:'1234', submission: testSubmission}, function(err, res){
        assert.ok(!err);
        assert.ok(res);

        assert.ok(submissionStartedEventCalled, "Expected the submission started event to have been called.");

        $fh.forms.completeSubmission({appClientId:'1234', submission: {submissionId: "submission1234"}}, function(err, res){
          assert.ok(!err);
          assert.ok(res);

          assert.ok(submissionCompleteEventCalled, "Expected the submission complete event to have been called");

          $fh.forms.deregisterListener(submissionEventListener, finish);
        });
      });
    });
  },
  'test submitFormData Validation Error Event': function(finish){
    var submissionStartedSpy = sinon.spy();
    var submissionCompletedSpy = sinon.spy();
    var submissionErrorSpy = sinon.spy();

    var mockErrorResponse = {
      error: {
        valid: false,
        somefieldid: {
          fieldId: "somefieldid",
          valid: false,
          fieldErrorMessage: ["Entry Not Valid", null]
        },
        anotherfieldid: {
          fieldId: "anotherfieldid",
          valid: false,
          fieldErrorMessage: [null, "Entry Not Valid"]
        }
      }
    };
    var mockSubmitFormData = sinon.stub();

    mockSubmitFormData.withArgs(sinon.match.object, sinon.match.func).callsArgWith(1, undefined, mockErrorResponse);

    var $fh = proxyquire('../lib/api.js', {
      'fh-mbaas-client' : {
        '@global': true,
        initEnvironment: sinon.stub(),
        app: {
          forms: {
            submitFormData: mockSubmitFormData
          }
        }
    }});

    var submissionEventListener = new events.EventEmitter();

    $fh.forms.registerListener(submissionEventListener, function(err){
      assert.ok(!err, "Expected no error when adding a submission event listener.");

      //Listening to submissionStarted events
      submissionEventListener.on('submissionStarted', submissionStartedSpy);

      //Listening to submissionComplete events
      submissionEventListener.on('submissionComplete', submissionCompletedSpy);

      //Listening For The Error Response
      submissionEventListener.on('submissionError', submissionErrorSpy);

      $fh.forms.submitFormData({appClientId:'1234', submission: testSubmission}, function(err, res){
        assert.ok(err, "Expected An Error");
        assert.ok(!res, "Expected No Response");

        sinon.assert.notCalled(submissionStartedSpy);
        sinon.assert.notCalled(submissionCompletedSpy);
        sinon.assert.calledOnce(submissionErrorSpy);
        sinon.assert.calledWith(submissionErrorSpy, sinon.match({
          type: sinon.match('validationError'),
          error: sinon.match(mockErrorResponse.error)
        }));

        $fh.forms.deregisterListener(submissionEventListener, finish);
      });
    });
  },
  'test submitFormData JSON Submission Error': function(finish){
    var submissionStartedSpy = sinon.spy();
    var submissionCompletedSpy = sinon.spy();
    var submissionErrorSpy = sinon.spy();

    var mockErrorResponse = new Error("Error Submitting Data");
    var mockSubmitFormData = sinon.stub();

    mockSubmitFormData.withArgs(sinon.match.object, sinon.match.func).callsArgWith(1, mockErrorResponse);

    var $fh = proxyquire('../lib/api.js', {
      'fh-mbaas-client' : {
        '@global': true,
        initEnvironment: sinon.stub(),
        app: {
          forms: {
            submitFormData: mockSubmitFormData
          }
        }
      }});

    var submissionEventListener = new events.EventEmitter();

    $fh.forms.registerListener(submissionEventListener, function(err){
      assert.ok(!err, "Expected no error when adding a submission event listener.");

      //Listening to submissionStarted events
      submissionEventListener.on('submissionStarted', submissionStartedSpy);

      //Listening to submissionComplete events
      submissionEventListener.on('submissionComplete', submissionCompletedSpy);

      //Listening For The Error Response
      submissionEventListener.on('submissionError', submissionErrorSpy);

      $fh.forms.submitFormData({appClientId:'1234', submission: testSubmission}, function(err, res){
        assert.ok(err, "Expected An Error");
        assert.ok(!res, "Expected No Response");

        sinon.assert.notCalled(submissionStartedSpy);
        sinon.assert.notCalled(submissionCompletedSpy);
        sinon.assert.calledOnce(submissionErrorSpy);
        sinon.assert.calledWith(submissionErrorSpy, sinon.match({
          type: sinon.match('jsonError'),
          error: sinon.match(mockErrorResponse)
        }));

        $fh.forms.deregisterListener(submissionEventListener, finish);
      });
    });
  },
  //Testing that a submission model requires a form.
  'test Submission Model' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.createSubmissionModel({}, function(err, submission){
      assert.ok(err, "Expected err but got nothing");
      assert.ok(err.toLowerCase().indexOf("no form") > -1, "Expected a no form error");
      finish();
    });
  },
  'test Create Submission Model' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});

    $fh.forms.getForm({appClientId:'1234', "_id": "someformId"}, function(err, form){
      assert.ok(!err, "Unexpected error " + err);
      $fh.forms.createSubmissionModel({form: form}, function(err, submission){
        assert.ok(!err, "Unexpected error " + err);

        assert.ok(submission, "Expected a submission but got nothing.");
        assert.ok(submission.submissionData, "Expected submission Data but got nothing");
        assert.ok(submission.submissionData.formId === "someformId", "Expected submission formId to be someformId but got: " + submission.submissionData.formId);
        finish();
      });
    });
  },
  'test Add Input Value' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});

    $fh.forms.getForm({appClientId:'1234', "_id": "formId1234"}, function(err, form){
      assert.ok(!err, "Unexpected error " + err);
      $fh.forms.createSubmissionModel({form: form}, function(err, submission){
        assert.ok(!err, "Unexpected error " + err);

        //Testing fieldId field selector
        var err = submission.addFieldInput({fieldId: "fieldText", value: "sometext"});

        assert.ok(!err, "Unexpected error " + err);
        assert.ok(submission.fieldValues["fieldText"].length === 1, "Expected length to be 1 but was " + submission.fieldValues["fieldText"].length);
        assert.ok(submission.fieldValues["fieldText"][0] === "sometext", "Expected input to be sometext but was " + submission.fieldValues["fieldText"][0]);

        err = submission.addFieldInput({fieldCode: "fieldTextCode", value: "sometext2", index: 1});
        assert.ok(!err, "Unexpected error " + err);

        assert.ok(submission.fieldValues["fieldText"].length === 2, "Expected length to be 1 but was " + submission.fieldValues["fieldText"].length);
        assert.ok(submission.fieldValues["fieldText"][0] === "sometext", "Expected input to be sometext but was " + submission.fieldValues["fieldText"][0]);
        assert.ok(submission.fieldValues["fieldText"][1] === "sometext2", "Expected input to be sometext2 but was " + submission.fieldValues["fieldText"][1]);

        finish();
      });
    });
  },
  'test Add File Input Value' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});

    $fh.forms.getForm({appClientId:'1234', "_id": "formId1234"}, function(err, form){
      assert.ok(!err, "Unexpected error " + err);
      $fh.forms.createSubmissionModel({form: form}, function(err, submission){
        assert.ok(!err, "Unexpected error " + err);

        //Testing fieldId field selector
        var err = submission.addFieldInput({fieldId: "fieldPhoto", value: {fileName: "someFileName", fileSize: 123, fileType: "image/jpeg", fileStream: __dirname + '/fixtures/testimg1.jpg'}});
        assert.ok(!err, "Unexpected error " + err);

        assert.ok(submission.fieldValues["fieldPhoto"].length === 1, "Expected file input length to be 1 but was " + submission.fieldValues["fieldPhoto"].length);
        //Checking file 1
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileName === "someFileName", "Expected fileName to be someFileName but was " + submission.fieldValues["fieldPhoto"][0].fileName);
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileSize === 123, "Expected fileSize to be 123 but was " + submission.fieldValues["fieldPhoto"][0].fileSize);
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileType === "image/jpeg", "Expected fileSize to be image/jpeg but was " + submission.fieldValues["fieldPhoto"][0].fileType);
        assert.ok(!submission.fieldValues["fieldPhoto"][0].fileStream, "Unexpected fileStream parameter in submission data.");
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileUpdateTime, "Expected fileUpdateTime but was undefined");
        assert.ok(submission.fieldValues["fieldPhoto"][0].hashName, "Expected hashName but was undefined");

        err = submission.addFieldInput({fieldCode: "fieldPhotoCode", value: {fileName: "someFileName2", fileSize: 312, fileType: "image/png", fileStream: __dirname + '/fixtures/testimg2.png'}, index: 1});
        assert.ok(!err, "Unexpected error " + err);

        assert.ok(submission.fieldValues["fieldPhoto"].length === 2, "Expected file input length to be 2 but was " + submission.fieldValues["fieldPhoto"].length);

        //Checking file 1
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileName === "someFileName", "Expected fileName to be someFileName but was " + submission.fieldValues["fieldPhoto"][0].fileName);
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileSize === 123, "Expected fileSize to be 123 but was " + submission.fieldValues["fieldPhoto"][0].fileSize);
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileType === "image/jpeg", "Expected fileSize to be image/jpeg but was " + submission.fieldValues["fieldPhoto"][0].fileType);
        assert.ok(!submission.fieldValues["fieldPhoto"][0].fileStream, "Unexpected fileStream parameter in submission data.");
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileUpdateTime, "Expected fileUpdateTime but was undefined");
        assert.ok(submission.fieldValues["fieldPhoto"][0].hashName, "Expected hashName but was undefined");

        //Checking file 2
        assert.ok(submission.fieldValues["fieldPhoto"][1].fileName === "someFileName2", "Expected fileName to be someFileName but was " + submission.fieldValues["fieldPhoto"][1].fileName);
        assert.ok(submission.fieldValues["fieldPhoto"][1].fileSize === 312, "Expected fileSize to be 123 but was " + submission.fieldValues["fieldPhoto"][1].fileSize);
        assert.ok(submission.fieldValues["fieldPhoto"][1].fileType === "image/png", "Expected fileSize to be image/jpeg but was " + submission.fieldValues["fieldPhoto"][1].fileType);
        assert.ok(!submission.fieldValues["fieldPhoto"][1].fileStream, "Unexpected fileStream parameter in submission data.");
        assert.ok(submission.fieldValues["fieldPhoto"][1].fileUpdateTime, "Expected fileUpdateTime but was undefined");
        assert.ok(submission.fieldValues["fieldPhoto"][1].hashName, "Expected hashName but was undefined");

        assert.ok(submission.fieldValues["fieldPhoto"][0].hashName !== submission.fieldValues["fieldPhoto"][1].hashName, "hashNames for 2 files are the same.");

        finish();
      });
    });
  },
  'test Submit Submission With File' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});

    $fh.forms.getForm({appClientId:'1234', "_id": "formId1234"}, function(err, form){
      assert.ok(!err, "Unexpected error " + err);
      $fh.forms.createSubmissionModel({form: form, keepFiles: true}, function(err, submission){
        assert.ok(!err, "Unexpected error " + err);

        //Testing fieldId field selector

        var err = submission.addFieldInput({fieldId: "fieldPhoto", value: {fileName: "someFileName", fileSize: 123, fileType: "image/jpeg", fileStream: __dirname + '/fixtures/testimg1.jpg'}});
        assert.ok(!err, "Unexpected error " + err);

        assert.ok(submission.fieldValues["fieldPhoto"].length === 1, "Expected file input length to be 1 but was " + submission.fieldValues["fieldPhoto"].length);
        //Checking file 1
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileName === "someFileName", "Expected fileName to be someFileName but was " + submission.fieldValues["fieldPhoto"][0].fileName);
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileSize === 123, "Expected fileSize to be 123 but was " + submission.fieldValues["fieldPhoto"][0].fileSize);
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileType === "image/jpeg", "Expected fileSize to be image/jpeg but was " + submission.fieldValues["fieldPhoto"][0].fileType);
        assert.ok(!submission.fieldValues["fieldPhoto"][0].fileStream, "Unexpected fileStream parameter in submission data.");
        assert.ok(submission.fieldValues["fieldPhoto"][0].fileUpdateTime, "Expected fileUpdateTime but was undefined");
        assert.ok(submission.fieldValues["fieldPhoto"][0].hashName, "Expected hashName but was undefined");

        err = submission.addFieldInput({fieldId: "fieldText", value: "sometext"});
        assert.ok(!err, "Unexpected error " + err);

        submission.submit(function(err, submissionId){
          assert.ok(!err, "Unexpected error " + err);
          assert.ok(submissionId === "submissionId123456", "Expected submission Id to be submissionId123456 but was " + submissionId);
          finish();
        });
      });
    });
  },
  'test submitFormFile' : function(finish){
    console.log("submitFormFile");
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.submitFormFile({appClientId:'1234', submission: {fileStream: "./test/fixtures/testimg1.jpg", fileId: "SomeFileID", submissionId: "ASubmissionId", fieldId: "fileFieldId"}}, function(err, res){
      assert.ok(!err, "submitFormFile should not return an error");
      assert.ok(res, "submitFormFile should return a response");
      finish();
    });
  },
  'test submitFormFile file does not exist' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.submitFormFile({appClientId:'1234', submission: {fileStream: "./test/fixtures/idontexist.jpg", fileId: "SomeFileID", submissionId: "ASubmissionId", fieldId: "fileFieldId"}}, function(err, res){
      assert.ok(err, "Expected An Error When Submitting A file that does not exist");
      assert.ok(err.message.indexOf("exist") > -1, "Expected Error Message To Contain 'exists'")
      assert.ok(!res, "Expected no result");
      finish();
    });
  },
  'test getSubmissionStatus' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getSubmissionStatus({appClientId:'1234', submission: {submissionId: "submission1234"}}, function(err, res){
      assert.ok(!err, "getSubmissionStatus should not return an error");
      assert.ok(res, "getSubmissionStatus should return a response");
      finish();
    });
  },
  'test completeSubmission' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.completeSubmission({appClientId:'1234', submission: {submissionId: "submission1234"}}, function(err, res){
      assert.ok(!err, "completeSubmission should not return an error");
      assert.ok(res, "completeSubmission should return a response");
      finish();
    });
  },
  'test getAppClientConfig' : function(finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getAppClientConfig({appClientId:'1234', deviceId: "deviceId1234"}, function(err, res){
      assert.ok(!err);
      assert.ok(res);
      finish();
    });
  },
  "test getFullyPopulatedForms ": function (finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getPopulatedFormList({"formids":[]}, function(err, res){
      assert.ok(!err, "getFullyPopulatedForms should not return an error");
      assert.ok(res, "getFullyPopulatedForms should return a response");
      finish();
    });
  },
  "test getSubmissions ": function (finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getSubmissions({"subid":[]}, function(err, res){
      assert.ok(!err, "getSubmissions should not return an error");
      assert.ok(res, "getSubmissions should return a response");
      finish();
    });
  },
  "test getSubmission ": function (finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getSubmission({"submissionId": "submission1234"}, function(err, res){
      assert.ok(!err, "getSubmission should not return an error");
      assert.ok(res, "getSubmission should return a response");
      finish();
    });
  },
  "test getSubmissions with files": function (finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getSubmissions({"subid":["submissionId1", "submissionId2"]}, function(err, res){
      assert.ok(!err, "getSubmissions with files should not return an error");
      assert.ok(res, "getSubmissions with files should return a response");
      finish();
    });
  },
  "test getSubmissionFile ": function (finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.getSubmissionFile({"_id": "testSubFileGroupId"}, function(err, res){
      assert.ok(!err, "getSubmissionFile should not return an error");
      assert.ok(res, "getSubmissionFile should return a response");
      finish();
    });
  },
  "test exportCSV ": function (finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.exportCSV({projectId: "projectId", submissionId: "submissionId", formId: "formId", fieldHeader: "fieldHeader"}, function(err, streamOutput){
      assert.ok(!err, "Export CSV should not return an error");
      assert.ok(streamOutput, "Export CSV should return a response");
      assert.ok(streamOutput instanceof stream.Readable, "CSV callback parameter streamOutput is a readable stream");
      finish();
    });
  },
  "test exportSinglePDF ": function (finish){
    var $fh = proxyquire('../lib/api.js', {'fh-mbaas-client' : mockMbaasClient});
    $fh.forms.exportSinglePDF({submissionId: "MySubmission"}, function(err, streamOutput){
      assert.ok(!err, "Export a single PDF should not return an error");
      assert.ok(streamOutput, "Export a single PDF should return a response stream for the PDF");
      assert.ok(streamOutput instanceof stream.Readable, "PDF callback parameter streamOutput is a readable stream");
      finish();
    });
  }
};