#!/usr/bin/env bash
docker rm -f $(docker ps -a -q  --filter name=mongodb2.4)
echo "Mongodb Stopped"
docker rm -f $(docker ps -a -q  --filter name=redis2.6)
echo "Redis Stopped"