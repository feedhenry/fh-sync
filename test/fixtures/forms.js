var assert = require('assert');
var _ = require('underscore');
var MockReadStream = require("./mockReadStream");

var formEventListeners = [];

module.exports = {
  '@global': true,
  initEnvironment: function(environment, mbaasConf){
    assert.ok(environment);
    assert.ok(mbaasConf);
  },
  app: {
    forms: {
      list: function(options, cb){
        assert.ok(options, "Expected options but got nothing");
        return cb(undefined, [])
      },
      get: function(options, cb){
        assert.ok(options, "Expected options but got nothing");
        assert.ok(options.id, "Expected form id but got nothing");
        cb(undefined, {"_id": "someformId", pages:
          [
            {
              fields:
                [
                  {
                    _id: "fieldText",
                    fieldCode: "fieldTextCode",
                    type: "text"
                  },
                  {
                    _id: "fieldPhoto",
                    fieldCode: "fieldPhotoCode",
                    type: "photo"
                  }
                ]
            }
          ]
        });
      },
      submitFormData: function (options, cb) {
        assert.ok(options);
        assert.ok(options.id);
        assert.ok(options.submission);

        cb(undefined, {"submissionId": "submissionId123456"});
      },
      search: function(options, cb){
        assert.ok(options.searchParams, "Expected searchParams but got nothing");
        return cb(undefined, []);
      }
    },
    themes: {
      get: function(options, cb){
        assert.ok(options, "Expected options but got nothing");
        cb(undefined, {"_id": "someThemeId"});
      }
    },
    submissions: {
      uploadFile: function(options, cb){
        assert.ok(options, "Expected options but got nothing");
        assert.ok(options.id);
        assert.ok(options.fieldId);
        assert.ok(options.fileId);
        assert.ok(options.fileDetails.stream);
        assert.ok(options.fileDetails.size);
        assert.ok(options.fileDetails.type);
        assert.ok(options.fileDetails.name);
        cb(undefined, {"status": "ok"});
      },
      complete: function(options, cb){
        assert.ok(options.id);

        cb(undefined, {formSubmission: {_id: "submissionid1234", submissionCompletedTimestamp: 12345}, "status": "complete"});
      },
      status: function(options, cb){
        assert.ok(options.id);

        cb(undefined, {"status": "pending"});
      },
      search: function(options, cb){
        assert.ok(options.searchParams, "Expected subids but got nothing");

        return cb(undefined, []);
      },
      get: function(options, cb){
        assert.ok(options.id, "Expected options._id but got nothing");
        cb(undefined, {});
      },
      getFile: function(options, cb){
        assert.ok(options.fileId, "Expected filegroupId but got nothing");
        return cb(undefined, {
          stream: "fileStream",
          type: "contentType",
          length: 122
        });
      },
      exportCSV: function(options, cb) {
        assert.ok(options.queryParams.projectId, "Expected projectId but got nothing");
        assert.ok(options.queryParams.submissionId, "Expected submissionId but got nothing");
        assert.ok(options.queryParams.formId, "Expected formId but got nothing");
        assert.ok(options.queryParams.fieldHeader, "Expected fieldHeader but got nothing");

        return cb(undefined, new MockReadStream());
      },
      exportSinglePDF: function(options, cb) {
        assert.ok(options.id, "Expected id but got nothing");
        assert.ok(options.domain, "Expected domain but got nothing");
        return cb(undefined, new MockReadStream());
      }
    },
    formsConfig: {
      get: function(options, cb){
        return cb(undefined, {client: {
          clientKey: "someClientVal"
        },
        cloud: {
          cloudKey: "someCloudVal"
        }});
      }
    }
  }
};
