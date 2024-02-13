const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_OTEL_FETCH_DISABLED: "1",
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  experimental: {
    instrumentationHook: true,
  },
  sassOptions: {
    includePaths: [path.join(__dirname, "src", "styles")],
  },
};

module.exports = nextConfig;
