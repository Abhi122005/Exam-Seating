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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
    env: {
      ADMIN_PASSWORD: "test-only-admin-password",
      BACKEND_SHARED_SECRET: "test-only-backend-secret",
      CRON_SECRET: "test-only-cron-secret",
    },
  },
});
