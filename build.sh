#! /bin/sh

PYTHON=bin/python
BIN=node_modules/.bin

set -e
${PYTHON} ./manage.py collectstatic --no-input
gulp
