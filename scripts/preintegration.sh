#!/usr/bin/env bash
docker pull mongo:2.4
docker stop -t 30 $(docker ps -a -q  --filter name=mongodb2.4)
docker run --rm -d -p 0.0.0.0:27017:27017 --name mongodb2.4 mongo:2.4
#give it some time to complete starting
sleep 30s
