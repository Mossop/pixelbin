FROM node:14-alpine

RUN \
  apk add --no-cache ffmpeg perl && \
  apk add --no-cache --virtual builddeps git python3 build-base && \
  mkdir -p /config /data /pixelbin

COPY . /pixelbin/

RUN \
  cd /pixelbin && \
  npm install && \
  apk del --no-network builddeps && \
  npm run build

ENV PATH="/pixelbin:${PATH}"

WORKDIR /config

EXPOSE 8000

ENTRYPOINT ["/pixelbin/pixelbin"]
