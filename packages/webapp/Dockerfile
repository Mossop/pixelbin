FROM node:lts-alpine3.19 AS builder

ENV NODE_ENV="production"

WORKDIR /build

COPY package.json package-lock.json /build/

# Install node modules. Should be cached unless the packages change.
RUN \
    --mount=type=cache,target=/root/.npm \
    # --mount=type=cache,target=/build/node_modules \
    --mount=type=bind,source=packages/webapp/package.json,target=/build/packages/webapp/package.json \
    npm ci && \
    npm install --no-save @rollup/rollup-linux-`node -p "process.arch"`-musl

COPY packages/webapp /build/packages/webapp

# Does the actual build using the cached node modules.
RUN \
    --mount=type=cache,target=/root/.npm \
    # --mount=type=cache,target=/build/node_modules \
    npm run build && \
    mkdir -p /app/packages/webapp && \
    cp -R node_modules package.json package-lock.json /app && \
    cd packages/webapp && \
    cp -R build public modules server.mjs package.json /app/packages/webapp

FROM node:lts-alpine3.19

COPY --from=builder /app /app

WORKDIR /app/packages/webapp

EXPOSE 3000

ENV PIXELBIN_API_URL="http://pixelbin-server:8283"
ENV NODE_ENV="production"

ENTRYPOINT ["node", "./server.mjs"]

HEALTHCHECK --start-period=30s --start-interval=2s --interval=60s CMD wget -qO- http://127.0.0.1:3000/api/config || exit 1

ARG SOURCE_CHANGESET
ENV SOURCE_CHANGESET=${SOURCE_CHANGESET:-unknown}

RUN find /app
