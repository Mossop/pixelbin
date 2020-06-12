#! /bin/bash

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=postgres")
  if [ -z "$container" ]; then
    echo "Postgres container is not running."
    exit 1
  fi

  WORKSPACE=$(cd $(dirname "${BASH_SOURCE[0]:-$0}") && cd .. && pwd | sed -e s/\\/$//g)
  cd $WORKSPACE

  rm -f pixelbin.sqlite

  rm -rf data/storage/*
  rm -rf public/media/storage/*
  exec docker exec -e PYTHON="${PYTHON}" -it $container /containers/rebuild_db.sh
else
  export PGPASSWORD=pixelbin

  QUERY="SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity \
         WHERE pg_stat_activity.datname = 'pixelbin' AND pid <> pg_backend_pid();"
  echo $QUERY | psql -h localhost -U pixelbin pixelbin > /dev/null
  dropdb -h localhost -U pixelbin pixelbin
  createdb -h localhost -U pixelbin pixelbin
  createdb -h localhost -U pixelbin pixelbin_test
  rm -rf data/storage/*
fi
