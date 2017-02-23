module.exports = function(options) {

  if (!options || options.defaultHandlers === undefined) {
    throw new Error('Default handlers were not passed in options.');
  }

  var names = {
    LIST: 'listHandler',
    CREATE: 'createHandler',
    READ: 'readHandler',
    UPDATE: 'updateHandler',
    DELETE: 'deleteHandler',
    COLLISION: 'collisionHandler'
  }
  var handlers = {};

  return {

    /**
     * Sets a custom list handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    listHandler: function(datasetId, handler) {
      setHandler(datasetId, names.LIST, handler);
    },

    /**
     * Sets a custom create handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    createHandler: function(datasetId, handler) {
      setHandler(datasetId, names.CREATE, handler);
    },

    /**
     * Sets a custom read handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    readHandler: function(datasetId, handler) {
      setHandler(datasetId, names.READ, handler);
    },

    /**
     * Sets a custom update handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    updateHandler: function(datasetId, handler) {
      setHandler(datasetId, names.UPDATE, handler);
    },

    /**
     * Sets a custom delete handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    deleteHandler: function(datasetId, handler) {
      setHandler(datasetId, names.DELETE, handler);
    },

    /**
     * Sets a custom collision handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    collisionHandler: function(datasetId, handler) {
      setHandler(datasetId, names.COLLISION, handler);
    },

    /**
     * @param datasetId
     * @param queryParams
     * @param metaData
     * @param callback
     */
    doList: function(datasetId, queryParams, metaData, callback) {
      var handler = handlerFor(datasetId, names.LIST);
      handler(datasetId, queryParams, metaData, callback);
    },

    /**
     * @param datasetId
     * @param record
     * @param metaData
     * @param callback
     */
    doCreate: function(datasetId, queryParams, metaData, callback) {
      var handler = handlerFor(datasetId, names.CREATE);
      handler(datasetId, queryParams, metaData, callback);
    },

    /**
     * @param datasetId
     * @param uid
     * @param metaData
     * @param callback
     */
    doRead: function(datasetId, uid, metaData, callback) {
      var handler = handlerFor(datasetId, names.READ);
      handler(datasetId, uid, metaData, callback);
    },

    /**
     * @param datasetId
     * @param uid
     * @param record
     * @param metaData
     * @param callback
     */
    doUpdate: function(datasetId, uid, record, metaData, callback) {
      var handler = handlerFor(datasetId, names.UPDATE);
      handler(datasetId, uid, record, metaData, callback);
    },

    /**
     * @param datasetId
     * @param uid
     * @param metaData
     * @param callback
     */
    doDelete: function(datasetId, uid, metaData, callback) {
      var handler = handlerFor(datasetId, names.DELETE);
      handler(datasetId, uid, metaData, callback);
    },

    /**
     * @param datasetId
     * @param metaData
     * @param collisionFields
     */
    handleCollision: function(datasetId, metaData, collisionFields, callback){
      var handler = handlerFor(datasetId, names.COLLISION);
      handler(datasetId, metaData, collisionFields, callback);
    }
  };

  function Handler(defaultHandlers) {
    this.listHandler = defaultHandlers.listHandler;
    this.createHandler = defaultHandlers.createHandler;
    this.readHandler = defaultHandlers.readHandler;
    this.updateHandler = defaultHandlers.updateHandler;
    this.deleteHandler = defaultHandlers.deleteHandler;
    this.collisionHandler = defaultHandlers.collisionHandler;
  }

  function setHandler(datasetId, handlerName, handler) {
    var handlers = handlersFor(datasetId);
    handlers[handlerName] = handler;
  }

  function handlerFor(datasetId, handlerName) {
    return handlersFor(datasetId)[handlerName];
  }

  function handlersFor(datasetId) {
    var handler = handlers[datasetId];
    if (!handler) {
      handler = new Handler(options.defaultHandlers);
      handlers[datasetId] = handler;
    }
    return handler;
  }

};
