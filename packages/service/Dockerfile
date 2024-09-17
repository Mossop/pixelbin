FROM rust:alpine3.19 AS builder

WORKDIR /build
ENV SQLX_OFFLINE=true
ENV RUSTFLAGS="-L/usr/lib/postgresql16 -lpgcommon -lpgport -lcrypto -lssl"

RUN apk add musl-dev libpq-dev postgresql16-dev openssl-libs-static nasm && mkdir /build/packages
COPY Cargo.toml Cargo.lock /build
COPY .sqlx /build/.sqlx
COPY packages/shared packages/migrations packages/service packages/cli /build/packages/
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build -p pixelbin_cli --locked --release

FROM alpine:3.19

RUN \
  mkdir -p /data /app /config && \
  apk add --no-cache ffmpeg exiftool libpq

WORKDIR /config

ENV PATH="${PATH}:/app"
ENV PIXELBIN_STORAGE="/data"
ENV PIXELBIN_PORT=8283
ENV PIXELBIN_DATABASE_URL="postgres://pixelbin:pixelbin@postgres/pixelbin"

EXPOSE 8283

ENTRYPOINT ["/app/pixelbin"]
CMD ["serve"]

HEALTHCHECK --start-period=30s --start-interval=2s --interval=60s CMD wget -qO- http://127.0.0.1:8283/api/config || exit 1

ARG SOURCE_CHANGESET
ENV SOURCE_CHANGESET=${SOURCE_CHANGESET:-unknown}

COPY --from=builder /build/target/release/pixelbin /app
