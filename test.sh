#! /bin/sh

set -e
./manage.py check
./manage.py makemigrations
./manage.py collectstatic --noinput
gulp buildCss
gulp watchBuild &
docker-compose up --force-recreate --build
