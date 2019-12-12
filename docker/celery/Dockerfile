FROM python:3

RUN \
  apt-get update && \
  apt-get install  -y --no-install-recommends \
    python-dev \
    ffmpeg \
    exiftool \
    sudo

RUN \
  addgroup --system --gid 1000 pixelbin && \
  adduser --system --gid 1000 --uid 1000 --disabled-password pixelbin && \
  mkdir -p /usr/src/scripts && \
  mkdir -p /usr/src/pixelbin

WORKDIR /usr/src/pixelbin

COPY requirements.txt requirements_postgres.txt /usr/src/pixelbin/
RUN pip install -r requirements.txt && \
    pip install -r requirements_postgres.txt

COPY docker/celery/start /usr/src/scripts/

ENTRYPOINT ["/usr/src/scripts/start"]
