FROM python:3

RUN \
  mkdir -p /usr/src/scripts && \
  mkdir -p /usr/src/app

COPY start /usr/src/scripts

WORKDIR /usr/src/app

ENTRYPOINT ["/usr/src/scripts/start"]
