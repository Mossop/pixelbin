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
    "@typescript-eslint/tslint",
    //"mossop-typescript"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
  ],
  "rules": {
    "require-atomic-updates": "off",
    "react/prop-types": "off",
    "@typescript-eslint/array-type": "error",
    "@typescript-eslint/no-unnecessary-condition": ["error", {
      ignoreRhs: true
    }],
    "quotes": "off",
    "@typescript-eslint/quotes": "warn",
    "brace-style": "off",
    "@typescript-eslint/brace-style": "warn",
    "indent": "off",
    "@typescript-eslint/indent": ["warn", 2],
    "prefer-const": "off",
    "no-multiple-empty-lines": "warn",
    "no-new-wrappers": "error",
    "no-throw-literal": "error",
    "semi": "off",
    "@typescript-eslint/semi": "error",
    "@typescript-eslint/ban-ts-ignore": "off",
    "@typescript-eslint/no-inferrable-types": ["warn", {
      "ignoreParameters": true,
      "ignoreProperties": true,
    }],
    "@typescript-eslint/typedef": "warn",
    // "mossop-typescript/type-errors": "error",
    // "mossop-typescript/type-warnings": "warn",
    // "mossop-typescript/type-messages": "warn",
    // "mossop-typescript/type-suggestions": "warn"
  },
  "overrides": [{
    // enable these rules specifically for TypeScript files
    "files": ["*.ts", "*.tsx"],
    "rules": {
      "@typescript-eslint/explicit-member-accessibility": "warn",
      "@typescript-eslint/tslint/config": [
        "warn", {
          "rules": {
            "typedef": [
              true,
              "call-signature",
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
