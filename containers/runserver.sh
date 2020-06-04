#! /bin/bash

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=pixelbin_api")
  if [ -z "$container" ]; then
    echo "API container is not running."
    exit 1
  fi
  exec docker exec -e PYTHON="${PYTHON:=python}" -it $container /workspace/containers/runserver.sh
else
  echo Launching server at http://localhost:8000
  ${PYTHON} manage.py runserver 0.0.0.0:8000
fi
