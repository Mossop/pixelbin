module.exports = {
  extends: [require.resolve("@mossop/config/next-ts/eslintrc")],

  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
};
