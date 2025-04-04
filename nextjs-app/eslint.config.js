// Use require for imports in CommonJS if needed, or keep dynamic import() if necessary
// Adjusting imports might be needed depending on how FlatCompat works in CJS context.
// Let's assume the original dynamic imports work or adjust if ESLint complains later.
const { dirname } = require("path");
const { fileURLToPath } = require("url");
const { FlatCompat } = require("@eslint/eslintrc");
// Assuming nextPlugin might need require or different handling in CJS
// If '@next/eslint-plugin-next' provides a CJS entry point:
const nextPlugin = require("@next/eslint-plugin-next"); 
// If not, you might need to investigate how to load ESM plugins in CJS eslint config

const __filename = fileURLToPath(import.meta.url); // Note: import.meta.url might behave differently in CJS. Often __filename is available directly.
const __dirname = dirname(__filename); // Often __dirname is available directly in CJS.

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "dist/**"],
  },
  // Assuming compat.extends works similarly here
  ...compat.extends("next/core-web-vitals"), 
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      // Example rule, ensure this is correct for your setup
      "@next/next/no-html-link-for-pages": "error", 
    },
  },
];

module.exports = eslintConfig;