#! /bin/bash

mkdir -p data/postgres
docker container rm -f pixelbin_db
set -e
docker run --name pixelbin_db --network pixelbin_net -p 5432:5432 --restart always \
  -e POSTGRES_USER=pixelbin \
  -e POSTGRES_PASSWORD=pixelbin \
  -v /Users/dave/workspace/pixelbin/data/postgres:/var/lib/postgresql/data \
  -d postgres
