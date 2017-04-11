var defaultRequestInterceptor = function(datasetId, params, callback) {
  return callback();
};

var defaultResponseInterceptor = function(datasetId, queryParams, callback) {
  return callback();
};

var requestInterceptors;
var responseInterceptors;
var defaults;

function initInterceptors() {
  requestInterceptors = {};
  responseInterceptors = {};
  defaults = {
    requestInterceptor: defaultRequestInterceptor,
    responseInterceptor: defaultResponseInterceptor
  };
}

initInterceptors();

module.exports = function() {
  return {
    /**
     * Can be used to check the request parameters or perform authentication checks
     * @param {String} datasetId
     * @param {Object} params
     * @param {Object} params.query_params
     * @param {Object} params.meta_data
     * @param {Function} callback
     */
    requestInterceptor: function(datasetId, params, callback) {
      var interceptor = requestInterceptors[datasetId] || defaults.requestInterceptor;
      return interceptor(datasetId, params, callback);
    },

    /**
     * //TODO: what is the purpose of this function?
     * @param {String} datasetId
     * @param {Object} queryParams
     * @param {Function} callback
     */
    responseInterceptor: function(datasetId, queryParams, callback) {
      var interceptor = responseInterceptors[datasetId] || defaults.responseInterceptor;
      return interceptor(datasetId, queryParams, callback);
    },

    /**
     * Set the request interceptor override for the given dataset
     * @param {String} datasetId
     * @param {Function} interceptor the request interceptor
     */
    setRequestInterceptor: function(datasetId, interceptor) {
      requestInterceptors[datasetId] = interceptor;
    },

    /**
     * Set the response interceptor override for the given dataset
     * @param {String} datasetId
     * @param {Function} interceptor the response interceptor
     */
    setResponseInterceptor: function(datasetId, interceptor) {
      responseInterceptors[datasetId] = interceptor;
    },

    /**
     * Set the default global request interceptor
     * @param {Function} interceptor the request interceptor
     */
    setDefaultRequestInterceptor: function(interceptor) {
      defaults.requestInterceptor = interceptor;
    },

    /**
     * Set the default global response interceptor
     * @param {Function} interceptor the response interceptor
     */
    setDefaultResponseInterceptor: function(interceptor) {
      defaults.responseInterceptor = interceptor;
    },

    /**
     * Reset to the default interceptors
     */
    restore: initInterceptors
  };
};