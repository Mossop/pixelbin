#! /bin/bash

set -e

WORKSPACE=$(cd $(dirname "${BASH_SOURCE[0]:-$0}") && cd .. && pwd | sed -e s/\\/$//g)
cd $WORKSPACE

TAG=${1:-"latest"}

docker build \
  --build-arg mode=development \
  --tag pixelbindev:${TAG} \
  .
