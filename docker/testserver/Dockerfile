FROM python:3

RUN \
  curl -sL https://deb.nodesource.com/setup_12.x | bash - && \
  apt-get install -y --no-install-recommends \
    nodejs \
    sudo

RUN \
  addgroup --system --gid 1000 pixelbin && \
  adduser --system --gid 1000 --uid 1000 --disabled-password pixelbin && \
  mkdir -p /usr/src/scripts && \
  mkdir -p /usr/src/pixelbin

COPY start /usr/src/scripts

WORKDIR /usr/src/pixelbin

EXPOSE 8000/tcp

ENTRYPOINT ["/usr/src/scripts/start"]
