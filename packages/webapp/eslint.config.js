import base from "@mossop/config/remix/eslint";

export default [
  { ignores: [".react-router/*"] },

  ...base,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ["./tsconfig.json"],
      },
    },

    rules: {
      "jsx-a11y/label-has-associated-control": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
