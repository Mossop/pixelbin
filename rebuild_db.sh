#! /bin/bash

EXEC=venv/bin/python3

docker exec -i pixelbin_db psql -U pixelbin -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'pixelbin' AND pid <> pg_backend_pid();"

docker exec -i pixelbin_db dropdb -U pixelbin pixelbin

set -e
docker exec -i pixelbin_db createdb -U pixelbin pixelbin
rm -rf data/storage

rm -f api/migrations/00*
${EXEC} ./manage.py makemigrations
${EXEC} ./manage.py migrate
${EXEC} ./manage.py createsuperuser --email dtownsend@oxymoronical.com --full_name="Dave Townsend"
