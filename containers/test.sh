#! /bin/bash

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=pixelbin_api")
  if [ -z "$container" ]; then
    echo "API container is not running."
    exit 1
  fi
  exec docker exec -e PYTHON="${PYTHON:=python}" -it $container /workspace/containers/test.sh
else
  ${PYTHON} manage.py test --no-input
fi
