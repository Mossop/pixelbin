module.exports = {
  extends: [
    "plugin:react-hooks/recommended",
  ],

  overrides: [{
    files: ["**/*.jsx", "**/*.tsx"],

    extends: [
      "plugin:mossop/react",
    ],

    rules: {
      "react/jsx-fragments": ["warn", "syntax"],
      "react/react-in-jsx-scope": "off",
    },

    env: {
      es6: true,
    },

    settings: {
      react: {
        version: "17.0",
      },
    },
  }],
};
