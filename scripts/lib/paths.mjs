import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const PUBLIC = join(ROOT, "public");
export const SRC = join(ROOT, "src");
export const DIST = join(ROOT, "dist");
