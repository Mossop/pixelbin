#! /bin/bash

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=pixelbin_api")
  exec docker exec -it $container /workspace/containers/runserver.sh
else
  echo Launching server at http://localhost:8000
  ./manage.py runserver 0.0.0.0:8000
fi
