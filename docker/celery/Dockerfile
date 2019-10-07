FROM python:3

WORKDIR /usr/src/pixelbin

RUN \
  apt-get update && \
  apt-get install  -y --no-install-recommends \
    ffmpeg \
    exiftool \
    sudo

RUN \
  addgroup --system --gid 1000 pixelbin && \
  adduser --system --gid 1000 --uid 1000 --disabled-password pixelbin && \
  mkdir -p /usr/src/scripts && \
  mkdir -p /usr/src/pixelbin

COPY docker/celery/start /usr/src/scripts/
COPY requirements.txt /usr/src/pixelbin/

RUN pip install -r requirements.txt

ENTRYPOINT ["/usr/src/scripts/start"]
