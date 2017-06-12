#!/usr/bin/env bash
docker rm -f $(docker ps -a -q  --filter name=mongodb-fh-mbaas-api)
echo "Mongodb Stopped"
docker rm -f $(docker ps -a -q  --filter name=redis-fh-mbaas-api)
echo "Redis Stopped"
