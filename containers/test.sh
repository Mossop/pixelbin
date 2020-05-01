#! /bin/bash

if [ -z "$CONTAINER" ]; then
  container=$(docker container ls -q --filter "ancestor=pixelbin_api")
  exec docker exec -it $container /workspace/containers/test.sh
else
  ./manage.py test
fi
