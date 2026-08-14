import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const entries = [
  "index.html",
  "404.html",
  "projects",
  "experience",
  "triplecheck",
  "musatro",
  "assets",
  "css",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "CNAME",
];

for (const entry of entries) {
  if (!existsSync(join(root, entry))) {
    throw new Error(`Missing ${entry}. Run \`npm run build\` first.`);
  }
}

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
}
mkdirSync(dist, { recursive: true });

for (const entry of entries) {
  cpSync(join(root, entry), join(dist, entry), { recursive: true });
}

writeFileSync(join(dist, ".nojekyll"), "");
