import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DIST, PUBLIC, ROOT, SRC } from "./lib/paths.mjs";

export function prepareDist() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(PUBLIC, DIST, { recursive: true });
  mkdirSync(join(DIST, "css"), { recursive: true });
  cpSync(join(SRC, "styles.css"), join(DIST, "css", "styles.css"));
  cpSync(join(ROOT, "content", "llms.txt"), join(DIST, "llms.txt"));
  writeFileSync(join(DIST, ".nojekyll"), "");
}
