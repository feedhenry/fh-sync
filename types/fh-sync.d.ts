// Type definitions for fh-sync
// Project: https://github.com/feedhenry/fh-sync
// Maintainer feedhenry-dev@redhat.com

declare module SyncCloud {
    /**
     * Options used to initialize Sync Server
     */
    interface SyncGlobalOptions {
        /** How often pending workers should check for the next job, in ms. Default: 1 */
        pendingWorkerInterval?: number;
        /** The concurrency value of the pending workers. Default is 1. Can set to 0 to disable the pendingWorkers completely */
        pendingWorkerConcurrency?: number;
        /** The backoff strategy for the pending worker to use.
         * Default strategy is `exp` (exponential) with a max delay of 60s. The min value will always be the same as `pendingWorkerInterval`
         * The other valid strategy is `fib` (fibonacci). Set it to anything else will disable the backoff behavior */
        pendingWorkerBackoff?: PendingWorkerBackoff;
        /** How often ack workers should check for the next job, in ms. Default: 1 */
        ackWorkerInterval?: number;
        /** The concurrency value of the ack workers. Default is 1. Can set to 0 to disable the ackWorker completely */
        ackWorkerConcurrency?: number;
        /**
         * The backoff strategy for the ack worker to use.
         * Default strategy is `exp` (exponential) with a max delay of 60s. The min value will always be the same as `ackWorkerInterval`
         * The other valid strategy is `fib` (fibonacci). Set it to anything else will disable the backoff behavior  */
        ackWorkerBackoff?: AckWorkerBackoff;
        /** How often sync workers should check for the next job, in ms. Default: 100 */
        syncWorkerInterval?: number;
        /** The concurrency value of the sync workers. Default is 1. Can set to 0 to disable the syncWorker completely. */
        syncWorkgerConcurrency?: number;
        /** the backoff strategy for the sync worker to use.
         * Default strategy is `exp` (exponential) with a max delay of 1s. The min value will always be the same as `syncWorkerInterval`
         * Other valid strategies are `none` and `fib` (fibonacci).*/
        syncWorkerBackoff?: SyncWorkerBackoff;
        /** How often the scheduler should check the datasetClients, in ms. Default: 500 */
        schedulerInterval?: number;
        /** The max time a scheduler can hold the lock for, in ms. Default: 20000 */
        schedulerLockMaxTime?: number;
        /** The default lock name for the sync scheduler */
        schedulerLockName?: string;
        /** The default concurrency value when update dataset clients in the sync API. Default is 10. In most case this value should not need to be changed */
        datasetClientUpdateConcurrency?: number;
        /** Enable/disable collect sync stats to allow query via an endpoint */
        collectStats?: boolean;
        /** The number of records to keep in order to compute the stats data. Default is 1000. */
        statsRecordsToKeep?: number;
        /** How often the stats should be collected. In milliseconds. */
        collectStatsInterval?: number;
        /** The host of the influxdb server. If set, the metrics data will be sent to the influxdb server. */
        metricsInfluxdbHost?: string;
        /** The port of the influxdb server. It should be a UDP port. */
        metricsInfluxdbPort?: number;
        /** The concurrency value for the component metrics. Default is 10. This value should be increased if there are many concurrent workers. Otherwise the memory useage of the app could go up.*/
        metricsReportConcurrency?: number;
        /** If cache the dataset client records using redis. This can help improve performance for the syncRecords API.
         * Can be turned on if there are no records are shared between many different dataset clients. Default is false.*/
        useCache?: boolean;
        /**The TTL (Time To Live) value for the messages on the queue. In seconds. Default to 24 hours. */
        queueMessagesTTL?: string;
        /** Specify the maximum retention time of an inactive datasetClient. Any inactive datasetClient that is older than this period of time will be removed.*/
        datasetClientCleanerRetentionPeriod?: string;
        /** Specify the frequency the datasetClient cleaner should run. Default every hour ('1h').*/
        datasetClientCleanerCheckFrequency?: string;
    }

    /**
     * Backoff Strategy
     * Example: {strategy: 'exp', max: 60*1000},
     */
    interface PendingWorkerBackoff {
        strategy: string;
        max: number;
    }
    /**
     * Backoff Strategy
     * Example: {strategy: 'exp', max: 60*1000},
     */
    interface AckWorkerBackoff {
        strategy: string;
        max: number;
    }

    /**
     * Backoff Strategy
     * Example: {strategy: 'exp', max: 60*1000},
     */
    interface SyncWorkerBackoff {
        strategy: string;
        max: number;
    }

    type StandardCb<T> = (err: Error | string | undefined, res?: T | undefined) => void;
    type NoRespCb = (err: Error | string | undefined) => void;

    /**
     * Options used to initialize sync for specific dataset
     */
    interface SyncInitOptions {
        /**
         * Value indicating how often the dataset client should be sync with the backend. Matches the clients default
         * frequency. Value in seconds
         */
        syncFrequency?: number,

        /**
         * Value that will be used to decide if the dataset client is not active anymore.
         */
        clientSyncTimeout?: number,

        /**
         * Value that determines how long it should wait for the backend list operation to complete
         */
        backendListTimeout?: number,

        /**
         * Specify the max wait time the dataset can be scheduled to sync again after its previous schedule, in seconds.
         */
        maxScheduleWaitTime?: number
    }

    /**
     * Parameters object for request and response interceptors
     */
    interface SyncInterceptParams {
        query_params: any;
        metaData: any;
    }
    /**
     * Connect sync server to mongo and redis
     *
     * @param mongoDBConnectionUrl
     * @param mongoDBConnectionOption
     * @param redisUrl
     * @param cb
     */
    function connect(mongoDBConnectionUrl: string, mongoDBConnectionOption: any, redisUrl: string, callback: (err: any, mongoDbClient?: any, redisClient?: any) => void): void;

    /**
     * Initialize sync for specific dataset
     *
     * @param datasetId
     * @param options
     * @param callback
     */
    function init(datasetId: string, options: SyncInitOptions, callback: StandardCb<void>): void;

    /**
     * Internal method used to invoke sync methods. Used to handle json request from client.
     * Supported operations 'sync', 'syncRecords', 'listCollisions', 'removeCollision'
     *
     * @param datasetId
     * @param options
     * @param callback
     */
    function invoke(datasetId: string, options: any, callback: (err: any, result: any) => void): void;

    /**
     * Stop sync loop for dataset
     *
     * @param datasetId
     * @param onStop callback called when operation is finished
     */
    function stop(datasetId: string, onStop: NoRespCb): void;

    /**
     * Stop sync loop for all datasets
     *
     * @param datasetId
     * @param onStop callback called when operation is finished
     */
    function stopAll(onStop: StandardCb<string[]>): void;

    /**
     * Handle list operation for specific dataset.
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param datasetId - unique id of the dataset (usually collection, table in your database)
     * @param onList - function called to retrieve data
     * params - set of call parameters (usually query string) used to filter out data
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function handleList(datasetId: string, onList: (datasetId: string, params: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle list operation for all datasets
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param onList - function called to retrieve data
     * params - set of call parameters (usually query string) used to filter out data
     * metadtata - metdata for query - can contain any additional information that is not part of the query
     */
    function globalHandleList(onList: (datasetId: string, params: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle create operation for specific dataset
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param datasetId - unique id of the dataset (usually collection, table in your database)
     * @param onCreate - function called to create data entry
     * @param data - data that needs to be stored
     * @param metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function handleCreate(datasetId: string, onCreate: (datasetId: string, data: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle create operation for all datasets
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param onCreate - function called to create data entry
     * data - data that needs to be stored
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function globalHandleCreate(onCreate: (datasetId: string, data: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle read operation for specific dataset
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param datasetId - unique id of the dataset (usually collection, table in your database)
     * @param onRead - function called to read single data entry
     * uid - data identifier
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function handleRead(datasetId: string, onRead: (datasetId: string, uid: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle read operation for all datasets
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param onRead - function called to read single data entry
     * uid - data identifier
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function globalHandleRead(onRead: (datasetId: string, uid: string, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle update operation for specific dataset
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param datasetId - unique id of the dataset (usually collection, table in your database)
     * @param onUpdate - function called to update single data entry
     * uid - data identifier
     * data - data that needs to be stored
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function handleUpdate(datasetId: string, onUpdate: (datasetId: string, uid: string, data: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle update operation for all datasets
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param onUpdate - function called to update single data entry
     * uid - data identifier
     * data - data that needs to be stored
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function globalHandleUpdate(onUpdate: (datasetId: string, uid: string, data: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle delete operation for specific dataset
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     *
     * @param datasetId - unique id of the dataset (usually collection, table in your database)
     * @param onDelete - function called to delete single data entry
     * uid - data identifier
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function handleDelete(datasetId: string, onDelete: (datasetId: string, uid: string, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle delete operation for all datasets
     * Method may be used to override default data handler to have control over how sync is retrieving and storing data
     * 
     * @param onDelete - function called to delete single data entry
     * uid - data identifier
     * metadtata - metdata for query  - can contain any additional information that is not part of the query
     */
    function globalHandleDelete(onDelete: (datasetId: string, uid: string, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle data collision for specific dataset (when both entries were changed)
     *
     * @param datasetId
     * @param onCollision method called on collision
     */
    function handleCollision(datasetId: string, onCollision: (datasetId: string, hash: string, timestamp: any, uid: string, pre: any, post: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Handle data collision for all managed datasets (when both entries were changed)
     *
     * @param datasetId
     * @param onCollision method called on collision
     */
    function globalHandleCollision(onCollision: (datasetId: string, hash: string, timestamp: Date, uid: string, pre: any, post: any, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * List collisions for specific dataset
     *
     * @param datasetId
     * @param onList
     */
    function listCollisions(datasetId: string, onList: (datasetId: string, metaData: any, callback: StandardCb<{ [hash: string]: any }>) => void): void;

    /**
     * List collisions for all datasets
     *
     * @param datasetId
     * @param onList
     */
    function globalListCollisions(onList: (datasetId: string, metaData: any, callback: StandardCb<{ [hash: string]: any }>) => void): void;

    /**
     * Remove collision from dataset?
     */
    function removeCollision(datasetId: string, onRemove: (datasetId: string, collision_hash: string, metaData: any, callback: StandardCb<any>) => void): void;

    /**
     * Request interceptor for dataset - allows to perform custom operations before executing sync method.
     */
    function interceptRequest(datasetId: string, onIntercept: (datasetId: string, interceptorParams: SyncInterceptParams, callback: NoRespCb) => void): void;

    /**
     * Response interceptor for dataset - allows to perform custom operations after executing sync method.
     */
    function interceptResponse(datasetId: string, onIntercept: (datasetId: string, interceptorParams: SyncInterceptParams, callback: NoRespCb) => void): void;

    /**
     * Set configuration for sync
     */
    function setConfig(config: SyncGlobalOptions): void;

    /**
     * Request interceptor for all sync calls - allows to perform custom operations after executing sync method.
     */
    function globalInterceptRequest(onIntercept: (datasetId: string, interceptorParams: SyncInterceptParams, callback: NoRespCb) => void): void;

    /**
     * Response interceptor for all sync calls - allows to perform custom operations after executing sync method.
     */
    function globalInterceptResponse(onIntercept: (datasetId: string, interceptorParams: SyncInterceptParams, callback: NoRespCb) => void): void;

    /**
     * Sets custom global hashing method for determining if objects were changed.
     *
     * @param datasetId
     * @param hashFunction allows to perform hashing for array of hashes returned for specific datasets
     */
    function setGlobalHashFn(datasetId: string, hashFunction: (target: string[]) => string): void;

    /**
     * Sets custom dataset hashing method for determining if objects were changed.
     *
     * @param datasetId
     * @param hashFunction  allows to perform hashing for dataset
     */
    function setRecordHashFn(datasetId: string, hashFunction: (target: any) => string): void;
}
export = SyncCloud;
