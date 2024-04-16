FROM node:lts-alpine3.19

RUN \
  mkdir -p /app

WORKDIR /app

COPY packages/webapp /app

RUN \
  npm i g @rollup/rollup-linux-`node -p "process.arch"`-musl && \
  npm install && \
  npm run build

EXPOSE 3000

ENV PIXELBIN_API_URL="http://pixelbin-server:8283"

ENTRYPOINT ["npm", "start"]

HEALTHCHECK --interval=10s CMD wget -qO- http://localhost:3000/api/config || exit 1

ARG SOURCE_CHANGESET
ENV SOURCE_CHANGESET=${SOURCE_CHANGESET:-unknown}
