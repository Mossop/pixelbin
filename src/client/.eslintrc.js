module.exports = {
  "extends": [
    "plugin:react-hooks/recommended",
  ],

  "overrides": [{
    "files": ["js/**/*.jsx", "js/**/*.tsx"],

    "extends": [
      "plugin:mossop/react",
    ],

    "env": {
      "es6": true,
    },

    "settings": {
      "react": {
        "version": "16.13",
      },
    },
  }],
};
