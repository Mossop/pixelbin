module.exports = {
  extends: [require.resolve("@mossop/config/remix-ts/eslintrc")],

  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
};
