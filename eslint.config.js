const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");

module.exports = tseslint.config(
  { ignores: ["out/", "node_modules/", "coverage/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "linebreak-style": ["error", "unix"],
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "no-console": "off",
      "no-var": "warn",
      "no-case-declarations": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-require-imports": "off",
      "object-curly-spacing": ["error", "always"],
    },
  },
  {
    files: ["test/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  }
);
