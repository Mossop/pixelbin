FROM rust:alpine3.19 AS builder

RUN \
  mkdir -p /build/packages

WORKDIR /build

COPY Cargo.toml Cargo.lock /build
COPY packages/service /build/packages/service

RUN apk add musl-dev libpq-dev postgresql16-dev openssl-libs-static
RUN RUSTFLAGS="-L/usr/lib/postgresql16 -lpgcommon -lpgport -lcrypto -lssl" cargo build --release

FROM alpine:3.19

RUN \
  mkdir -p /data /app /config && \
  apk add --no-cache ffmpeg exiftool libpq

COPY --from=builder /build/target/release/pixelbin /app

WORKDIR /config

ENV PIXELBIN_STORAGE="/data"
ENV PIXELBIN_PORT=8283
ENV PIXELBIN_DATABASE_URL="postgres://pixelbin:pixelbin@postgres/pixelbin"

EXPOSE 8283

ENTRYPOINT ["/app/pixelbin", "serve"]
