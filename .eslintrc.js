module.exports = {
  "parser": "@typescript-eslint/parser",

  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true,
    },
    "tsconfigRootDir": __dirname,
    "project": ["./tsconfig.json", "./src/*/tsconfig.json"],
  },

  "settings": {
    "import/ignore": [
      "typescript",
    ],
  },

  "env": {
    "node": true,
    "es6": true,
  },

  "plugins": [
    "mossop",
  ],

  "extends": [
    "plugin:mossop/typescript",
  ],

  "rules": {
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-unused-vars": ["warn", {
      "args": "after-used",
      "argsIgnorePattern": "^_",
      "ignoreRestSiblings": true,
      "caughtErrors": "none",
    }],
  },

  "ignorePatterns": ["build/**/*"],

  "overrides": [{
    "files": [
      "**/*.test.js",
      "**/*.test.jsx",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__mocks__/*.js",
      "**/__mocks__/*.ts",
    ],

    "env": {
      "jest": true,
    },
  }],
};
