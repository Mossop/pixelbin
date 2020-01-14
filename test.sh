#! /bin/sh

if [ -z "$VIRTUAL_ENV" ]; then
  . venv/bin/activate
fi

set -e
./manage.py check
./manage.py makemigrations
./manage.py migrate
./manage.py buildtypes
gulp build
gulp watchBuild &
docker-compose up --force-recreate
