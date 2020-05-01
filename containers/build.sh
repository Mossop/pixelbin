#! /bin/bash

WORKSPACE=$(cd $(dirname "${BASH_SOURCE[0]:-$0}") && cd .. && pwd | sed -e s/\\/$//g)

docker-compose -p pixelbin -f ${WORKSPACE}/containers/docker-compose.yml build --parallel
