#! /bin/bash

WORKSPACE=$(cd $(dirname "${BASH_SOURCE[0]:-$0}") && cd .. && pwd | sed -e s/\\/$//g)
cd $WORKSPACE

${WORKSPACE}/containers/remove.sh

rm -rf testrun/temp
rm -rf testrun/local

${WORKSPACE}/containers/start.sh

container=$(docker container ls -q --filter "ancestor=postgres")
# Note the container automatically creates the pixelbin user and database.
docker exec -it $container createdb -h localhost -U pixelbin pixelbin_test
npm run init-test-db
