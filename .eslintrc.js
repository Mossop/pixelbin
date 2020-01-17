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
    "import",
    //"mossop-typescript"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  "rules": {
    "require-atomic-updates": "off",
    "react/prop-types": "off",
    "@typescript-eslint/array-type": "error",
    "@typescript-eslint/no-use-before-define": ["error", {
      functions: false,
      typedefs: false,
      variables: false,
      enums: false,
    }],
    "@typescript-eslint/no-unnecessary-condition": ["error", {
      ignoreRhs: true
    }],
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
    }],
    "quotes": "off",
    "brace-style": "off",
    "indent": "off",
    "prefer-const": "off",
    "no-multiple-empty-lines": ["warn", {
      "max": 1,
    }],
    "no-new-wrappers": "error",
    "no-throw-literal": "error",
    "semi": "off",
    "import/order": ["warn", {
      "groups": [
        "builtin",
        "external",
        "internal",
        "unknown",
        ["parent", "sibling", "index"],
      ],
      "newlines-between": "always",
    }],
    "import/first": "warn",
    "import/extensions": ["warn", "never"],
    "import/newline-after-import": "warn",
    "@typescript-eslint/quotes": "warn",
    "@typescript-eslint/brace-style": "warn",
    "@typescript-eslint/indent": ["warn", 2],
    "@typescript-eslint/semi": "error",
    "@typescript-eslint/ban-ts-ignore": "off",
    "@typescript-eslint/no-empty-interface": "off",
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
