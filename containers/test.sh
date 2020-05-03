#! /bin/bash

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=pixelbin_api")
  if [ -z "$container" ]; then
    echo "API container is not running."
    exit 1
  fi
  exec docker exec -it $container /workspace/containers/test.sh
else
  ./manage.py test
fi
