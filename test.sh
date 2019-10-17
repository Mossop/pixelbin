#! /bin/sh

set -e
./manage.py check
chmod 666 data/pixelbin.sqlite
./manage.py collectstatic --noinput
gulp buildCss
gulp watchBuild &
docker-compose up --force-recreate --build
