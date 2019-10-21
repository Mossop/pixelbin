FROM python:3

EXPOSE 8000/tcp

RUN \
  apt-get update && \
  apt-get install  -y --no-install-recommends \
    python-dev \
    default-libmysqlclient-dev \
    sudo

RUN \
  addgroup --system --gid 1000 pixelbin && \
  adduser --system --gid 1000 --uid 1000 --disabled-password pixelbin && \
  mkdir -p /usr/src/scripts && \
  mkdir -p /usr/src/pixelbin

WORKDIR /usr/src/pixelbin

COPY manage.py requirements.txt /usr/src/pixelbin/
RUN pip install -r requirements.txt
RUN pip install mysqlclient

COPY docker/server/start /usr/src/scripts/

ENTRYPOINT ["/usr/src/scripts/start"]
