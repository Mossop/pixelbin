import base from "@mossop/config/remix/eslint";

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: ".",
        project: ["./tsconfig.json"],
      },
    },

    rules: {
      "jsx-a11y/label-has-associated-control": "off",
    },
  },
];
