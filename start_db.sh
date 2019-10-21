#! /bin/bash

docker network rm pixelbin_net
docker network create pixelbin_net

docker build -t pixelbin_mysql docker/mysql
docker container rm -f pixelbin_db
docker run --name pixelbin_db --network pixelbin_net -p 3306:3306 -e MYSQL_ROOT_PASSWORD=pixelbin -d pixelbin_mysql
