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
    requestInterceptor: function() {
      
    },

    /**
     * //TODO: what is the purpose of this function?
     * @param {String} datasetId
     * @param {Object} queryParams
     * @param {Function} callback
     */
    responseInterceptor: function() {

    }
  }
}