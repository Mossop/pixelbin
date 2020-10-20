#! /bin/bash

WORKSPACE=$(cd $(dirname "${BASH_SOURCE[0]:-$0}") && cd .. && pwd | sed -e s/\\/$//g)
cd $WORKSPACE

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=postgres")
  if [ -z "$container" ]; then
    echo "Postgres container is not running."
    exit 1
  fi

  rm -f pixelbin.sqlite

  docker-compose -p pixelbin -f ${WORKSPACE}/containers/docker-compose.yml stop minio
  docker-compose -p pixelbin -f ${WORKSPACE}/containers/docker-compose.yml stop redis

  rm -rf data/server/*
  rm -rf data/minio/*
  rm -rf data/redis/*

  mkdir -p data/minio/pixelbin
  mkdir -p data/minio/pixelbin-test

  ${WORKSPACE}/containers/start.sh

  container=$(docker container ls -q --filter "ancestor=postgres")
  docker exec -e PYTHON="${PYTHON}" -it $container /containers/rebuild.sh
  gulp migrate
else
  export PGPASSWORD=pixelbin

  QUERY="SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity \
         WHERE pg_stat_activity.datname = 'pixelbin' AND pid <> pg_backend_pid();"
  echo $QUERY | psql -h localhost -U pixelbin pixelbin > /dev/null
  dropdb -h localhost -U pixelbin pixelbin
  dropdb -h localhost -U pixelbin pixelbin_test
  createdb -h localhost -U pixelbin pixelbin
  createdb -h localhost -U pixelbin pixelbin_test
fi
