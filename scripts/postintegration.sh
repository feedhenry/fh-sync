#!/usr/bin/env bash
docker rm -f $(docker ps -a -q  --filter name=mongodb2.4)