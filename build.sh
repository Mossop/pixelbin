#! /bin/sh

PYTHON=bin/python
BIN=node_modules/.bin

gulp lint

set -e
${PYTHON} ./manage.py collectstatic --no-input
gulp bundle
${PYTHON} ./manage.py makemigrations
${PYTHON} ./manage.py migrate
