module.exports = {
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },

  extends: [require.resolve("@mossop/config/web-ts/eslintrc")],

  env: {
    browser: true,
  },
};
