FROM node:lts-alpine3.19

RUN \
  mkdir -p /app

WORKDIR /app

COPY packages/webapp/package.json packages/webapp/package-lock.json /app
RUN npm install --omit=dev && \
    npm install --no-save @rollup/rollup-linux-`node -p "process.arch"`-musl

EXPOSE 3000

ENV PIXELBIN_API_URL="http://pixelbin-server:8283"

ENTRYPOINT ["npm", "start"]

HEALTHCHECK --start-period=30s --start-interval=2s --interval=60s CMD wget -qO- http://127.0.0.1:3000/api/config || exit 1

ARG SOURCE_CHANGESET
ENV SOURCE_CHANGESET=${SOURCE_CHANGESET:-unknown}

COPY packages/webapp /app
RUN npm run build
