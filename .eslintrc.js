module.exports = {
  "parser": "babel-eslint",
  "env": {
    "browser": true,
    "es6": true,
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:import/errors",
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
      2, {
        "MemberExpression": "off",
        "SwitchCase": 1,
      }
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
    "comma-dangle": [
      "error",
      "always-multiline"
    ],
    "consistent-return": "error",
    "no-console": "off",
  },
  "settings": {
    "react": {
      "version": "16.4.2",
    },
  },
};
