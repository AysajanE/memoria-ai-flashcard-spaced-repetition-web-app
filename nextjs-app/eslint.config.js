const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  { 
    ignores: ["node_modules/**", ".next/**", "dist/**", "drizzle/**"] 
  },
  ...compat.extends("next/core-web-vitals"),
];
