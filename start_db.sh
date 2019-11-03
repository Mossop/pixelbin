#! /bin/bash

mkdir -p data/mysql
docker container rm -f pixelbin_db
set -e
docker run --name pixelbin_db --network pixelbin_net -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=pixelbin \
  -v /Users/dave/workspace/pixelbin/data/mysql:/var/lib/mysql \
  -d mossop/mysql
