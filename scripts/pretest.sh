#!/usr/bin/env bash

REDIS_VERSION=${REDIS_VERSION:-2.6}
MONGODB_VERSION=${MONGODB_VERSION:-2.4}

echo "Starting Redis-$REDIS_VERSION"
docker pull redis:$REDIS_VERSION
docker rm -f $(docker ps -a -q  --filter name=redis-fh-mbaas-api)
docker run -d -p 127.0.0.1:6379:6379 --name redis-fh-mbaas-api redis:$REDIS_VERSION

echo "Starting Mongodb-$MONGODB_VERSION"
docker pull mongo:$MONGODB_VERSION
docker rm -f $(docker ps -a -q  --filter name=mongodb-fh-mbaas-api)
docker run -d -p 127.0.0.1:27017:27017 --name mongodb-fh-mbaas-api mongo:$MONGODB_VERSION mongod --smallfiles
#give it some time to complete starting
sleep 30s
