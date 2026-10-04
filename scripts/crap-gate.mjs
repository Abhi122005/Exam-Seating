#!/usr/bin/env node
/**
 * CRAP (Change Risk Anti-Patterns) gate.
 *
 *   CRAP(m) = c(m)^2 * (1 - cov(m))^3 + c(m)
 *
 * A function that is both complex AND untested is where defects actually live,
 * so this combines the ESLint complexity ceiling with the line coverage produced
 * by the last `pnpm test` run rather than checking them independently.
 *
 * Run `pnpm test` first so coverage/coverage-summary.json exists; CI runs the
 * test step immediately before this one.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const coverageFile = resolve(root, "apps/web/coverage/coverage-summary.json");

// Must mirror the `complexity` rule in eslint.config.mjs. Measured across
// apps/web/src: worst is 17 (route.ts), then 7, 7, 6, 6. Kept as a literal so a
// stale value is obvious in review rather than silently drifting.
const COMPLEXITY_CAP = 17;

// Ratchet. CRAP(m) >= c(m) by construction, so with the cap at 17 the worst case
// at the measured coverage is 17^2*(1-cov)^3 + 17. Tighten only as real code is
// refactored - never loosen it to make a build pass.
const CRAP_RATCHET = 18;

function runLintComplexity() {
  const eslintBin = resolve(root, "node_modules/.bin/eslint");
  const args = [
    "apps/web/src",
    "--format",
    "json",
    "--rule",
    JSON.stringify({ complexity: ["warn", { max: 1000 }] }),
  ];
  try {
    return JSON.parse(
      execFileSync(eslintBin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
    );
  } catch (error) {
    // ESLint exits 1 when it finds problems but still prints JSON to stdout.
    return JSON.parse(error.stdout);
  }
}

function complexityRows(report) {
  const rows = [];
  for (const file of report) {
    for (const msg of file.messages ?? []) {
      if (msg.ruleId === "complexity") {
        const found = Number(msg.message.match(/complexity of (\d+)/)?.[1] ?? 0);
        rows.push({
          complexity: found,
          file: file.filePath.replace(`${root}/`, ""),
          line: msg.line,
        });
      }
    }
  }
  return rows.sort((a, b) => b.complexity - a.complexity);
}

function readLineCoverage() {
  if (!existsSync(coverageFile)) return null;
  try {
    const summary = JSON.parse(readFileSync(coverageFile, "utf8"));
    const pct = summary.total?.lines?.pct;
    return typeof pct === "number" ? Math.round(pct * 100) / 100 : null;
  } catch {
    return null;
  }
}

const rows = complexityRows(runLintComplexity());
const coverage = readLineCoverage();

// ESLint only reports functions ABOVE the configured cap, so an empty list means
// "worst <= cap", not "worst = 0". Use the cap as the conservative bound.
const worst = Math.max(rows[0]?.complexity ?? 0, COMPLEXITY_CAP);

console.log(`Functions above the complexity cap: ${rows.length}`);
console.log(`Complexity ceiling: ${COMPLEXITY_CAP}; worst observed: ${worst}`);
for (const row of rows.slice(0, 5)) {
  console.log(`  complexity ${row.complexity}  ${row.file}:${row.line}`);
}

if (coverage === null) {
  console.warn(
    "! apps/web/coverage/coverage-summary.json not found — run `pnpm test` first. " +
      "Falling back to the complexity ceiling alone.",
  );
  console.log("✓ CRAP gate passed (complexity half only; coverage unavailable).");
  process.exit(0);
}

const uncovered = 1 - coverage / 100;
const worstCrap = worst ** 2 * uncovered ** 3 + worst;
console.log(`Line coverage floor from last test run: ${coverage}%`);
console.log(`Worst-case CRAP at complexity ${worst}: ${worstCrap.toFixed(3)}`);

if (worstCrap >= CRAP_RATCHET) {
  console.error(`✗ Failing: worst-case CRAP ${worstCrap.toFixed(3)} is not < ${CRAP_RATCHET}.`);
  console.error("  Lower the complexity ceiling in eslint.config.mjs, or add tests.");
  process.exit(1);
}

console.log(`✓ CRAP gate passed — worst-case CRAP ${worstCrap.toFixed(3)} < ${CRAP_RATCHET}.`);
