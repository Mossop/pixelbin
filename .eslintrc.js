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

    "no-multiple-empty-lines": ["warn", {
      max: 1,
      maxBOF: 0,
      maxEOF: 0,
    }],

    "@typescript-eslint/naming-convention": ["warn",
      {
        selector: "default",
        format: ["camelCase"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: "variable",
        modifiers: ["const", "global"],
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: "variable",
        modifiers: ["const", "global", "exported"],
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: ["variable", "parameter"],
        modifiers: ["destructured"],
        format: null,
      },
      {
        selector: ["function"],
        format: ["camelCase", "PascalCase"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: ["variable", "function"],
        modifiers: ["exported"],
        format: ["camelCase", "PascalCase"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: "variableLike",
        format: ["camelCase"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: "parameter",
        format: ["camelCase"],
        leadingUnderscore: "allow",
        trailingUnderscore: "forbid",
      },
      {
        selector: "objectLiteralProperty",
        format: null,
        types: ["boolean"],
        filter: {
          regex: "^__esModule$",
          match: true,
        },
        custom: {
          regex: "^__esModule$",
          match: true,
        },
      },
      {
        selector: "memberLike",
        modifiers: ["private"],
        format: ["camelCase"],
        leadingUnderscore: "allow",
        trailingUnderscore: "forbid",
      },
      {
        selector: "memberLike",
        modifiers: ["protected"],
        format: ["camelCase"],
        leadingUnderscore: "allow",
        trailingUnderscore: "forbid",
      },
      {
        selector: "memberLike",
        format: ["camelCase"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: "enumMember",
        format: ["PascalCase"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      },
      {
        selector: "typeLike",
        format: ["PascalCase"],
        leadingUnderscore: "forbid",
        trailingUnderscore: "forbid",
      }],
  },

  ignorePatterns: ["dist/**/*"],

  overrides: [{
    files: [
      "**/*.test.js",
      "**/*.test.jsx",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__mocks__/*.js",
      "**/__mocks__/*.ts",
      "**/test-helpers*",
    ],

    env: {
      jest: true,
    },

    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  }, {
    files: ["*.ts", "*.tsx"],
  }],
};
