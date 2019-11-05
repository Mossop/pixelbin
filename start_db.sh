#! /bin/bash

mkdir -p data/mysql
docker container rm -f pixelbin_db
set -e
docker run --name pixelbin_db --network pixelbin_net -p 3306:3306 --restart always \
  -e MYSQL_ROOT_PASSWORD=pixelbin \
  -v /Users/dave/workspace/pixelbin/data/mysql:/var/lib/mysql \
  -d mossop/mysql
docker run --name phpmyadmin --network pixelbin_net -d -e PMA_HOST=pixelbin_db -p 8090:80 --restart always phpmyadmin/phpmyadmin
