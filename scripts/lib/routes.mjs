import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./paths.mjs";

export const LANDING_PAGES = [
  {
    slug: "ai-consulting",
    source: "content/pages/ai-consulting.md",
    schemaKind: "service",
    serviceType: "AI consulting, AI solutions architecture, freelance AI solutions architect",
    areaServed: ["Madrid", "Spain", "Europe", "remote"],
  },
  {
    slug: "ai-for-pharma-operations",
    source: "content/pages/ai-for-pharma-operations.md",
    schemaKind: "article",
  },
  {
    slug: "case-studies",
    source: "content/pages/case-studies.md",
    schemaKind: "webpage",
  },
];

// Source categories are independent of the established public /experience/ URLs.
export function detailPages() {
  return ["experience", "projects", "education"].flatMap((collection) =>
    readdirSync(join(ROOT, "content", collection))
      .filter((file) => file.endsWith(".md") && file !== "index.md")
      .map((file) => ({
        slug: file.slice(0, -3),
        source: `content/${collection}/${file}`,
      })),
  );
}

export const COMMUNITY_SOURCE = "content/community/cursor.json";
