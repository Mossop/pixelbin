#! /bin/sh

set -e
./manage.py collectstatic --noinput
gulp bundle
docker-compose up --force-recreate --build
