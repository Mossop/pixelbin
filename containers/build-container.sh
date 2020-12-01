#! /bin/bash

set -e

WORKSPACE=$(cd $(dirname "${BASH_SOURCE[0]:-$0}") && cd .. && pwd | sed -e s/\\/$//g)
cd $WORKSPACE

TAG=${1:-"latest"}
TITLE=$(basename $(pwd))
URL=$(git config --get remote.origin.url | sed -E -e s/^git@github.com:\(.+\)\\.git$/https:\\/\\/github.com\\/\\1/)

docker build \
  --tag ghcr.io/mossop/pixelbin:${TAG} \
  --label "org.opencontainers.image.url=${URL}" \
  --label "org.opencontainers.image.source=${URL}" \
  --label "org.opencontainers.image.title=${TITLE}" \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  --label "org.opencontainers.image.created=$(date -Is)" \
  --label "org.opencontainers.image.version=${TAG}" \
  --label "org.opencontainers.image.description=The PixelBin server" \
  .

docker push ghcr.io/mossop/pixelbin:${TAG}
