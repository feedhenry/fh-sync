#!/usr/bin/env bash
docker pull mongo:2.4
docker rm -f $(docker ps -a -q  --filter name=mongodb2.4)
docker run -d -p 127.0.0.1:27017:27017 --name mongodb2.4 mongo:2.4
#give it some time to complete starting
sleep 30s
