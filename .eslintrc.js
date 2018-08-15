module.exports = {
  "env": {
    "browser": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
  ],
  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true,
    },
  },
  "rules": {
    "indent": [
      "error",
      2
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "double"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-unused-vars": "off"
  }
};
