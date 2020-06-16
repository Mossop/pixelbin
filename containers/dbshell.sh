#! /bin/bash

container=$(docker container ls -q --filter "ancestor=postgres")
if [ -z "$container" ]; then
  echo "Postgres container is not running."
  exit 1
fi

exec docker exec -e PYTHON="${PYTHON}" -it $container psql -h localhost -U pixelbin ${1:-pixelbin}
