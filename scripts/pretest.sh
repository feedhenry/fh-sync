#!/usr/bin/env bash
echo "Starting Redis-2.6"
docker pull redis:2.6
docker rm -f $(docker ps -a -q  --filter name=redis2.6)
docker run -d -p 127.0.0.1:6379:6379 --name redis2.6 redis:2.6
echo "Starting Mongodb-2.4"
docker pull mongo:2.4
docker rm -f $(docker ps -a -q  --filter name=mongodb2.4)
docker run -d -p 127.0.0.1:27017:27017 --name mongodb2.4 mongo:2.4
#give it some time to complete starting
sleep 30s
