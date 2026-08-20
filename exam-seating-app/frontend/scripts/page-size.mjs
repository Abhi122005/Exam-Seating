import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public");
const budget = 14 * 1024;
const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(filePath);
    else if (entry.name.endsWith(".html")) {
      const size = (await stat(filePath)).size;
      if (size > budget) failures.push(`${path.relative(process.cwd(), filePath)}: ${size} B`);
    }
  }
}

await walk(root);
if (failures.length) {
  console.error(`Page-size budget exceeded (${budget} B):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`Page-size guard passed (${budget} B raw HTML budget).`);
