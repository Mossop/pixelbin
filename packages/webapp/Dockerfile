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

ENV PXL_API_URL="http://pixelbin-server:8283"

ENTRYPOINT ["npm", "start"]