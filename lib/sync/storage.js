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
     * Create the give dataset if it doesn't no exist, or update the existing one.
     * Should return the datasetClient instance in the callback
     * @param {String} datasetClientId the id of the datasetClient
     * @param {String} fields the fields to upsert
     * @param {Function} callback
     */
    upsertDatasetClient: function() {

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
     * Read the given datasetclient record, and its assoicated records
     * @param {String} datasetClientId
     * @param {Function} callback
     */
    readDatasetClientWithRecords: function() {

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

    },

    /**
     * List the updates that match the given list criteria
     * @param {String} datasetId
     * @param {Object} criteria the list criteria, a mongodb query object
     * @param {Function} callback
     */
    listUpdates: function() {

    }
  };
};