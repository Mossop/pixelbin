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

  settings: {
    "import/ignore": [
      "typescript",
    ],
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
    "import/no-useless-path-segments": ["error", {
      noUselessIndex: true,
    }],
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
        from: "./src/client",
      }],
    }],
    "operator-linebreak": ["warn", "after", { overrides: { "?": "before", ":": "before" } }],
    "quote-props": ["warn", "consistent-as-needed"],
  },

  ignorePatterns: ["build/**/*"],

  overrides: [{
    files: [
      "**/*.test.js",
      "**/*.test.jsx",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__mocks__/*.js",
      "**/__mocks__/*.ts",
    ],

    env: {
      jest: true,
    },

    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  }, {
    files: ["*.ts", "*.tsx"],

    rules: {
      "@typescript-eslint/explicit-function-return-type": ["warn", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowConciseArrowFunctionExpressionsStartingWithVoid: true,
      }],
      "@typescript-eslint/typedef": ["warn", {
        arrayDestructuring: false,
        arrowParameter: true,
        memberVariableDeclaration: false,
        objectDestructuring: false,
        parameter: true,
        propertyDeclaration: true,
        variableDeclaration: false,
        variableDeclarationIgnoreFunction: true,
      }],
    },
  }],
};
