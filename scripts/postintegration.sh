#!/usr/bin/env bash
docker stop -t 30 $(docker ps -a -q  --filter name=mongodb2.4)