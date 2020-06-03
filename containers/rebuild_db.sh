#! /bin/bash

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=pixelbin_api")
  if [ -z "$container" ]; then
    echo "API container is not running."
    exit 1
  fi

  WORKSPACE=$(cd $(dirname "${BASH_SOURCE[0]:-$0}") && cd .. && pwd | sed -e s/\\/$//g)
  cd $WORKSPACE

  rm pixelbin.sqlite

  rm -f api/migrations/00*
  ./manage.py makemigrations -v 0
  ./manage.py buildtypes

  exec docker exec -it $container /workspace/containers/rebuild_db.sh
else
  export PGPASSWORD=pixelbin

  QUERY="SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity \
         WHERE pg_stat_activity.datname = 'pixelbin' AND pid <> pg_backend_pid();"
  echo $QUERY | psql -h postgres -U pixelbin pixelbin > /dev/null
  dropdb -h postgres -U pixelbin pixelbin
  createdb -h postgres -U pixelbin pixelbin
  rm -rf data/storage/*
  rm -rf public/media/storage/*

  ./manage.py migrate

  echo -e "from api.models import User\nUser.objects.create_user('dtownsend@oxymoronical.com', 'Dave Townsend', 'pixelbin')" | ./manage.py shell
fi
