FROM node:14-alpine

COPY . /pixelbin/

RUN \
  apk add --no-cache --virtual builddeps git python3 build-base && \
  cd /pixelbin && \
  npm install && \
  npm run build && \
  apk del --no-network builddeps && \
  apk add --no-cache ffmpeg

WORKDIR /config

ENTRYPOINT ["/pixelbin/pixelbin"]
