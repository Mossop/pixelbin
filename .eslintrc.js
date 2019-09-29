module.exports = {
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
    "project": "./tsconfig.json",
    "ecmaFeatures": {
      "jsx": true,
    },
  },
  "env": {
    "browser": true,
    "es6": true,
  },
  "settings": {
    "react": {
      "version": "detect",
    },
  },

  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
  ],
  "rules": {
    "@typescript-eslint/array-type": "error",
    "@typescript-eslint/no-unnecessary-condition": "error",
    "quotes": "off",
    "@typescript-eslint/quotes": "error",
    "brace-style": "off",
    "@typescript-eslint/brace-style": "error",
    "indent": "off",
    "@typescript-eslint/indent": ["error", 2],
    "prefer-const": "off",
  },
  "overrides": [{
    // enable these rules specifically for TypeScript files
    "files": ["*.ts", "*.tsx"],
    "rules": {
      "@typescript-eslint/explicit-member-accessibility": "error",
    }
  }, {
    // enable these rules specifically for TypeScript files
    "files": ["*.js", "*.jsx"],
    "rules": {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-var-requires": "off",
    }
  }]
};
