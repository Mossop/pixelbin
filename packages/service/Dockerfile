FROM rust:alpine3.19 AS builder

RUN mkdir -p /build/packages/service/src

WORKDIR /build

RUN apk add musl-dev libpq-dev postgresql16-dev openssl-libs-static nasm
COPY Cargo.toml Cargo.lock /build
COPY packages/service/Cargo.toml /build/packages/service
RUN \
  echo "fn main() {}" > /build/packages/service/src/main.rs && \
  RUSTFLAGS="-L/usr/lib/postgresql16 -lpgcommon -lpgport -lcrypto -lssl" cargo build --release && \
  rm -rf /build/packages/service

COPY packages/service /build/packages/service
RUN RUSTFLAGS="-L/usr/lib/postgresql16 -lpgcommon -lpgport -lcrypto -lssl" cargo build --release

FROM alpine:3.19

RUN \
  mkdir -p /data /app /config && \
  apk add --no-cache ffmpeg exiftool libpq

COPY --from=builder /build/target/release/pixelbin /app

WORKDIR /config

ENV PATH="${PATH}:/app"
ENV PIXELBIN_STORAGE="/data"
ENV PIXELBIN_PORT=8283
ENV PIXELBIN_DATABASE_URL="postgres://pixelbin:pixelbin@postgres/pixelbin"

EXPOSE 8283

ENTRYPOINT ["/app/pixelbin"]
CMD ["serve"]

HEALTHCHECK --interval=10s CMD wget -qO- http://localhost:8283/api/config || exit 1

ARG SOURCE_CHANGESET
ENV SOURCE_CHANGESET=${SOURCE_CHANGESET:-unknown}
