#! /bin/sh

exec docker exec -it pixelbin_db psql -U pixelbin pixelbin
