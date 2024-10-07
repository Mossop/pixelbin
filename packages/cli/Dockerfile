FROM rust:alpine3.19 AS builder

WORKDIR /build
ENV SQLX_OFFLINE=true
ENV CARGO_HOME=/cargo

RUN apk add musl-dev && \
    mkdir /build/packages /cargo

RUN --mount=type=cache,target=/cargo \
    --mount=type=cache,target=/build/target \
    du -sh $CARGO_HOME /build/target

RUN --mount=type=cache,target=/cargo \
    --mount=type=cache,target=/build/target \
    --mount=type=bind,source=Cargo.toml,target=/build/Cargo.toml \
    --mount=type=bind,source=Cargo.lock,target=/build/Cargo.lock \
    --mount=type=bind,source=.sqlx,target=/build/.sqlx \
    --mount=type=bind,source=packages/shared,target=/build/packages/shared \
    --mount=type=bind,source=packages/migrations,target=/build/packages/migrations \
    --mount=type=bind,source=packages/service,target=/build/packages/service \
    --mount=type=bind,source=packages/cli,target=/build/packages/cli \
    cargo build -p pixelbin_cli --locked --release && \
    cp /build/target/release/pixelbin /build/pixelbin

RUN --mount=type=cache,target=/cargo \
    --mount=type=cache,target=/build/target \
    du -sh $CARGO_HOME /build/target

FROM alpine:3.19

RUN \
  mkdir -p /data /app /config && \
  apk add --no-cache ffmpeg exiftool

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

COPY --from=builder /build/pixelbin /app
