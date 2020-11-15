FROM node:14-alpine

COPY . /pixelbin/

RUN \
  apk add --no-cache ffmpeg perl && \
  apk add --no-cache --virtual builddeps git python3 build-base && \
  cd /pixelbin && \
  npm install && \
  npm run build && \
  rm -rf node_modules && \
  npm install --only=production && \
  apk del --no-network builddeps && \
  npm cache clean --force && \
  mkdir -p /config /data

ENV PATH="/pixelbin:${PATH}"

WORKDIR /config

EXPOSE 8000

ENTRYPOINT ["/pixelbin/pixelbin"]
