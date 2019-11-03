#! /bin/bash

set -e
EXEC=venv/bin/python3

echo "DROP DATABASE IF EXISTS pixelbin; CREATE DATABASE pixelbin CHARACTER SET utf8;" | docker exec -i pixelbin_db mysql -u root -ppixelbin

${EXEC} ./manage.py migrate
${EXEC} ./manage.py createsuperuser --email dtownsend@oxymoronical.com --full_name="Dave Townsend"
