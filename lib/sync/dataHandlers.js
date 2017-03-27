var syncUtil = require('./util');
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
    COLLISION: 'collisionHandler',
    LIST_COLLISIONS: 'listCollisionsHandler',
    REMOVE_COLLISION: 'removeCollisionHandler'
  }
  var handlers;
  var globalHandlers;

  function initHandlers() {
    handlers = {};
    globalHandlers = {
      listHandler : options.defaultHandlers.doList,
      createHandler : options.defaultHandlers.doCreate,
      readHandler : options.defaultHandlers.doRead,
      updateHandler : options.defaultHandlers.doUpdate,
      deleteHandler : options.defaultHandlers.doDelete,
      collisionHandler : options.defaultHandlers.handleCollision,
      listCollisionsHandler : options.defaultHandlers.listCollisions,
      removeCollisionHandler : options.defaultHandlers.removeCollision
    }
  }

  initHandlers();

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
     * Sets a custom list collision handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    listCollisionsHandler: function(datasetId, handler) {
      setHandler(datasetId, names.LIST_COLLISIONS, handler);
    },

    /**
     * Sets a custom remove collision handler for the passed-in dataset
     * @param datasetId
     * @param handler
     */
    removeCollisionHandler: function(datasetId, handler) {
      setHandler(datasetId, names.REMOVE_COLLISION, handler);
    },

    /**
     * Sets a customer global list handler
     * @param {Function} handler
     */
    globalListHandler: function(handler) {
      setGlobalHander(names.LIST, handler);
    },

    /**
     * Sets a customer global create handler
     * @param {Function} handler
     */
    globalCreateHandler: function(handler) {
      setGlobalHander(names.CREATE, handler);
    },

    /**
     * Sets a customer global read handler
     * @param {Function} handler
     */
    globalReadHandler: function(handler) {
      setGlobalHander(names.READ, handler);
    },

    /**
     * Sets a customer global update handler
     * @param {Function} handler
     */
    globalUpdateHandler : function(handler) {
      setGlobalHander(names.UPDATE, handler);
    },

    /**
     * Sets a customer global delete handler
     * @param {Function} handler
     */
    globalDeleteHandler : function(handler) {
      setGlobalHander(names.DELETE, handler);
    },

    /**
     * Sets a customer global collision handler
     * @param {Function} handler
     */
    globalCollisionHandler: function(handler) {
      setGlobalHander(names.COLLISION, handler);
    },

    /**
     * Sets a customer global list collision handler
     * @param {Function} handler
     */
    globalListCollisionsHandler: function(handler) {
      setGlobalHander(names.LIST_COLLISIONS, handler);
    },

    /**
     * Sets a customer global remove collision handler
     * @param {Function} handler
     */
    globalRemoveCollisionHandler: function(handler) {
      setGlobalHander(names.REMOVE_COLLISION, handler);
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
    doCreate: function(datasetId, data, metaData, callback) {
      var handler = handlerFor(datasetId, names.CREATE);
      handler(datasetId, data, metaData, callback);
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
    handleCollision: function(datasetId, hash, timestamp, uid, pre, post, metaData, callback){
      var handler = handlerFor(datasetId, names.COLLISION);
      handler(datasetId, hash, timestamp, uid, pre, post, metaData, callback);
    },

    /**
     * @param datasetId
     * @param metaData
     * @param callback
     */
    listCollisions: function(datasetId, metaData, callback) {
      var handler = handlerFor(datasetId, names.LIST_COLLISIONS);
      handler(datasetId, metaData, callback);
    },

    /**
     * @param datasetId
     * @param dataHash
     * @param metaData
     * @param callback
     */
    removeCollision: function(datasetId, dataHash, metaData, callback) {
      var handler = handlerFor(datasetId, names.REMOVE_COLLISION);
      handler(datasetId, dataHash, metaData, callback);
    },

    restore: initHandlers
  };

  function setHandler(datasetId, handlerName, handler) {
    syncUtil.ensureHandlerIsFunction(handlerName, handler);
    var handlers = handlersFor(datasetId);
    handlers[handlerName] = handler;
  }

  function setGlobalHander(handlerName, handler) {
    syncUtil.ensureHandlerIsFunction(handlerName, handler);
    globalHandlers[handlerName] = handler;
  }

  function handlerFor(datasetId, handlerName) {
    var handler = handlersFor(datasetId)[handlerName];
    if (!handler) {
      handler = globalHandlers[handlerName];
    }
    return handler;
  }

  function handlersFor(datasetId) {
    var handler = handlers[datasetId];
    if (!handler) {
      handler = {};
      handlers[datasetId] = handler;
    }
    return handler;
  }

};
