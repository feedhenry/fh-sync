module.exports = function() {
  return {
    /**
     * list the currently managed dataset clients
     * @param {Function} callback
     */
    listDatasetClients: function() {

    },

    /**
     * remove the given datasetClients from the storage
     * @param {Array} datasetClientsToRemove
     * @param {Function} callback
     */
    removeDatasetClients: function() {

    },

    /**
     * update the given dataset client
     * @param {String} datasetClientId the id of the datasetClient
     * @param {Object} fields the fields to update
     */
    updateDatasetClient: function() {

    },

    /**
     * update the given dataset client with the given records
     * @param {String} datasetClientId the id of the datasetClient
     * @param {Object} fields the fields to update
     * @param {Array} records an array of records to save
     */
    updateDatasetClientWithRecords: function() {

    }
  };
};