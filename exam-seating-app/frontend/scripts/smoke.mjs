import { spawn } from "node:child_process";

const port = process.env.SMOKE_PORT || "3101";
const base = `http://127.0.0.1:${port}`;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "CEC2026";
const server = spawn("pnpm", ["start", "-p", port], {
  stdio: "pipe",
  shell: true,
  env: { ...process.env, ADMIN_PASSWORD: adminPassword },
});

const stop = () => server.kill();
process.on("exit", stop);
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/manifest`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js server did not become ready");
}

await waitForServer();
const checks = [
  ["/", 200],
  ["/exam", 200],
  ["/admin/login", 200],
  ["/admin/schedule", 200],
  ["/admin/upload", 200],
  ["/api/manifest", 200],
  ["/api/admin/manifest", 401],
  ["/api/qr?text=smoke", 200],
  ["/missing-route", 404],
];
for (const [route, expected] of checks) {
  const response = await fetch(`${base}${route}`);
  if (response.status !== expected)
    throw new Error(`${route}: expected ${expected}, got ${response.status}`);
}
const invalidLogin = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: "definitely-wrong" }),
});
if (invalidLogin.status !== 401)
  throw new Error(`invalid login: expected 401, got ${invalidLogin.status}`);
const validLogin = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: adminPassword }),
});
if (validLogin.status !== 200)
  throw new Error(`valid login: expected 200, got ${validLogin.status}`);
const session = validLogin.headers.get("set-cookie");
const authenticatedManifest = await fetch(`${base}/api/admin/manifest`, {
  headers: { cookie: session?.split(";")[0] || "" },
});
if (authenticatedManifest.status !== 200) {
  throw new Error(`authenticated manifest: expected 200, got ${authenticatedManifest.status}`);
}
console.log(`Smoke checks passed (${checks.length} routes plus login/session flow).`);
