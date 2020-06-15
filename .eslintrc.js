module.exports = {
  "parser": "@typescript-eslint/parser",

  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true,
    },
    "tsconfigRootDir": __dirname,
    "project": ["./tsconfig.json", "./packages/*/tsconfig.json"],
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
  },

  "ignorePatterns": ["packages/*/build"],
};
