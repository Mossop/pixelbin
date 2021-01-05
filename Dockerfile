FROM node:14-alpine

ARG mode=production

COPY . /pixelbin/

RUN \
  apk add --no-cache ffmpeg perl && \
  apk add --no-cache --virtual builddeps git python3 build-base && \
  cd /pixelbin && \
  npm install && \
  npm run buildStatic buildServer && \
  node ./ci/webpack.js $mode && \
  npm prune --production && \
  npm dedupe && \
  apk del --no-network builddeps && \
  npm cache clean --force && \
  mkdir -p /config /data

ENV PATH="/pixelbin:${PATH}"

WORKDIR /config

EXPOSE 8000

ENTRYPOINT ["/pixelbin/pixelbin"]
