import nextConfig from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const patchedNextConfig = [...nextConfig];

const nextRuleConfig = patchedNextConfig.find((config) => config.plugins?.["@next/next"]);
if (nextRuleConfig) {
  nextRuleConfig.rules = {
    ...(nextRuleConfig.rules ?? {}),
    "@next/next/no-html-link-for-pages": ["error", path.join(__dirname, "apps/web/src/app")],
  };
}

const config = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.local_data/**",
      "**/.husky/**",
      "**/coverage/**",
      "apps/web/public/polyfill.min.js",
    ],
  },
  ...patchedNextConfig,
];

export default config;
