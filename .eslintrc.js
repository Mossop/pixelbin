module.exports = {
  parser: "@typescript-eslint/parser",

  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },

  env: {
    node: true,
    es6: true,
  },

  plugins: [
    "mossop",
  ],

  extends: [
    "plugin:mossop/typescript",
  ],

  rules: {
    "import/no-restricted-paths": ["error", {
      zones: [{
        target: "./src",
        from: ".",
        except: [
          "./src",
          "./node_modules",
        ],
      }, {
        target: "./src/server",
        from: "./src/client",
      }, {
        target: "./src/client",
        from: "./src/server",
      }, {
        target: "./src/utils",
        from: "./src/server",
      }, {
        target: "./src/utils",
        from: "./src/client",
      }, {
        target: "./src/model",
        from: "./src/client",
      }, {
        target: "./src/model",
        from: "./src/server",
      }],
    }],
  },

  ignorePatterns: ["dist/**/*"],

  overrides: [{
    files: ["*.ts", "*.tsx"],
  }],
};
