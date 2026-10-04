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
      "**/.stryker-tmp/**",
      "apps/web/public/polyfill.min.js",
    ],
  },
  ...patchedNextConfig,
  // Cyclomatic complexity cap for app code. CRAP(m) = c^2*(1-cov)^3 + c, so
  // complexity and coverage are judged together by scripts/crap-gate.mjs.
  // Ratchet, not aspiration: the cap sits at the measured ceiling (worst is 17
  // in route.ts, then 7, 7, 6, 6) and tightens as code is refactored. Test
  // files are excluded - assertion branching is not production risk.
  {
    files: [
      "apps/web/src/**/*.js",
      "apps/web/src/**/*.jsx",
      "apps/web/src/**/*.ts",
      "apps/web/src/**/*.tsx",
    ],
    rules: {
      complexity: ["error", { max: 17 }],
    },
  },
  {
    files: ["**/*.test.*", "**/*.spec.*", "**/tests/**"],
    rules: {
      complexity: "off",
    },
  },
];

export default config;
