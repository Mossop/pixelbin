module.exports = {
  "parser": "@typescript-eslint/parser",

  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true,
    },
    "project": "./tsconfig.json"
  },

  "settings": {
    "react": {
      "version": "detect",
    },
    "import/ignore": [
      "typescript",
    ]
  },

  "env": {
    "browser": true,
    "es6": true,
  },

  "plugins": [
    "mossop",
  ],

  "extends": [
    "plugin:mossop/typescript",
    "plugin:mossop/react",
  ],
};
