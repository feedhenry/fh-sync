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
     * @param {Function} callback
     */
    updateDatasetClient: function() {

    },

    /**
     * update the given dataset client with the given records
     * @param {String} datasetClientId the id of the datasetClient
     * @param {Object} fields the fields to update
     * @param {Array} records an array of records to save
     * @param {Function} callback
     */
    updateDatasetClientWithRecords: function() {

    },

    /**
     * find the delete the given sync update
     * @param {String} datasetId
     * @param {Object} acknowledgement
     * @param {Function} callback
     */
    findAndDeleteUpdate: function() {

    },

    /**
     * Save the given sync update
     * @param {String} datasetId
     * @param {Object} syncUpdateFields
     * @param {Function} callback
     */
    saveUpdate: function() {

    }
  };
};