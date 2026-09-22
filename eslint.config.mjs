import nextConfig from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.local_data/**",
      "**/.husky/**",
      "apps/web/public/polyfill.min.js",
    ],
  },
  ...nextConfig,
  {
    rules: {
      "@next/next/no-html-link-for-pages": ["error", path.join(__dirname, "apps/web/src/app")],
    },
  },
];
