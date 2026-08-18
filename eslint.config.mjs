import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/.local_data/**", "**/.husky/**"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@next/next/no-html-link-for-pages": ["error", path.join(__dirname, "apps/web/src/app")],
    },
  },
];
