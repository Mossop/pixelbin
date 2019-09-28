#! /bin/sh

PYTHON=bin/python
BIN=node_modules/.bin

npm test

${PYTHON} ./manage.py collectstatic --no-input
${BIN}/webpack --config app/webpack.config.js
${PYTHON} ./manage.py makemigrations
${PYTHON} ./manage.py migrate
