#! /bin/sh

if [ -z "$VIRTUAL_ENV" ]; then
  . venv/bin/activate
fi

set -e
./manage.py check
./manage.py makemigrations
gulp build
gulp watchBuild &
docker-compose up --force-recreate
