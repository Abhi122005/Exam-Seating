import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // Stryker sandboxes a mutated copy of the suite under .stryker-tmp/. Without
    // this, vitest collects those copies too and the initial dry run fails on
    // duplicated/failed sandboxed tests.
    exclude: ["**/node_modules/**", "**/.stryker-tmp/**", "**/coverage/**"],
    coverage: {
      provider: "v8",
      // json-summary is required by scripts/crap-gate.mjs, which reads
      // coverage-summary.json to compute CRAP = c^2*(1-cov)^3 + c.
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // Ratchet, not aspiration: each sits just under the measured baseline
      // (92.59 stmts / 85.4 branch / 100 funcs / 93.31 lines) so this lands
      // green today and fails only on real regression. Coverage already ran
      // here, it was just never enforced - Sonar reads the lcov output but
      // nothing gates on it. Raise a number in the same PR that lifts it.
      thresholds: {
        statements: 90,
        branches: 82,
        functions: 95,
        lines: 90,
      },
    },
    env: {
      ADMIN_PASSWORD: "test-only-admin-password",
      BACKEND_SHARED_SECRET: "test-only-backend-secret",
      CRON_SECRET: "test-only-cron-secret",
    },
  },
});
