#! /bin/sh

set -e
./manage.py check
./manage.py makemigrations
gulp build
gulp watchBuild &
docker-compose up --force-recreate
