import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

const files = [
  "index.html",
  "app.js",
  "styles.css",
  ".nojekyll",
  "data/aircraft-types.json",
  "src/core/flighttime-core.js",
];

await fs.rm(dist, { recursive: true, force: true });

for (const file of files) {
  const source = path.join(root, file);
  const target = path.join(dist, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

console.log(`Built GitHub Pages artifact at ${dist}`);
