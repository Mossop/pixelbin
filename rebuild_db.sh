#! /bin/bash

EXEC=python3

export PGPASSWORD=pixelbin

echo "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'pixelbin' AND pid <> pg_backend_pid();" | psql -h postgres -U pixelbin pixelbin
dropdb -h postgres -U pixelbin pixelbin
createdb -h postgres -U pixelbin pixelbin
rm -rf data/storage
rm -rf public/media/storage

rm -f api/migrations/00*
./manage.py makemigrations
./manage.py migrate
./manage.py buildtypes

echo -e "from api.models import User\nUser.objects.create_superuser('dtownsend@oxymoronical.com', 'Dave Townsend', 'pixelbin')" | ./manage.py shell
