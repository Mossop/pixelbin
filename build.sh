#! /bin/sh

PYTHON=bin/python
BIN=node_modules/.bin

npm test

${BIN}/webpack --config app/webpack.config.js
${PYTHON} ./manage.py collectstatic --no-input
${PYTHON} ./manage.py makemigrations
${PYTHON} ./manage.py migrate
