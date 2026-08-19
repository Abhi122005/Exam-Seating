import { spawnSync } from "node:child_process";

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

for (const [cmd, args] of [
  ["ruff", ["check", "--fix", ...files]],
  ["ruff", ["format", ...files]],
]) {
  const { error, status, stderr } = spawnSync(cmd, args, { stdio: "inherit" });
  if (error && error.code === "ENOENT") {
    console.warn(
      "[lint-staged] ruff not found - skipping Python lint. Install: pip install ruff (or pip install -r services/parser/requirements-dev.txt)",
    );
    process.exit(0);
  }
  if (status !== 0) process.exit(status ?? 1);
}
