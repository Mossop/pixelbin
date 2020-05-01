FROM python:3.8

ENV PYTHONUNBUFFERED 1
ENV DEBIAN_FRONTEND=noninteractive

RUN \
  apt-get update && \
  apt-get install  -y --no-install-recommends \
    apt-utils \
    dialog && \
  apt-get upgrade -y && \
  apt-get install -y --no-install-recommends \
    less \
    ffmpeg \
    exiftool && \
  apt-get autoremove -y && \
  apt-get clean -y && \
  rm -rf /var/lib/apt/lists/* && \
  mkdir -p /workspace

WORKDIR /workspace

COPY requirements.txt requirements_postgres.txt /tmp/pip-tmp/

RUN \
  pip3 install \
    -r /tmp/pip-tmp/requirements.txt \
    -r /tmp/pip-tmp/requirements_postgres.txt \
    watchdog pyyaml argh

ENV DEBIAN_FRONTEND=dialog

CMD [ \
  "watchmedo", "auto-restart", "--directory=./", "--pattern=*.py", "--recursive", "--", \
  "celery", "worker", "--app", "api", "-l", "info" \
]
