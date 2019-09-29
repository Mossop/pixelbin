FROM python:3

RUN \
  apt-get update && \
  apt-get install  -y --no-install-recommends \
    ffmpeg \
    sudo

RUN \
  addgroup --system --gid 1000 pixelbin && \
  adduser --system --gid 1000 --uid 1000 --disabled-password pixelbin && \
  mkdir -p /usr/src/scripts && \
  mkdir -p /usr/src/pixelbin

COPY start /usr/src/scripts

WORKDIR /usr/src/pixelbin

ENTRYPOINT ["/usr/src/scripts/start"]
