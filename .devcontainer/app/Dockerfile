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

RUN \
  curl -sL https://deb.nodesource.com/setup_14.x | bash - && \
  apt-get install -y --no-install-recommends \
    nodejs \
    postgresql && \
  npm install -g gulp

ENV DEBIAN_FRONTEND=dialog

CMD ["sleep", "infinity"]
