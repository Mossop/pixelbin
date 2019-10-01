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
  "env": {
    "browser": true,
    "es6": true,
  },
  "settings": {
    "react": {
      "version": "detect",
    },
  },

  "plugins": [
    "@typescript-eslint",
    "@typescript-eslint/tslint"
  ],
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
    "no-multiple-empty-lines": "error",
    "no-new-wrappers": "error",
    "no-throw-literal": "error",
    "semi": "off",
    "@typescript-eslint/semi": "error",
    "@typescript-eslint/ban-ts-ignore": "off",
    "@typescript-eslint/no-inferrable-types": ["error", {
      "ignoreParameters": true,
      "ignoreProperties": true,
    }]
  },
  "overrides": [{
    // enable these rules specifically for TypeScript files
    "files": ["*.ts", "*.tsx"],
    "rules": {
      "@typescript-eslint/explicit-member-accessibility": "error",
      "@typescript-eslint/tslint/config": [
        "error", {
          "rules": {
            "typedef": [
              true,
              "call-signature",
              "parameter",
              "arrow-parameter",
              "property-declaration",
              "member-variable-declaration",
            ]
          }
        }
      ]
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
