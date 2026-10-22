import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { DIST, ROOT } from "./lib/paths.mjs";
import { LANDING_PAGES, detailPages } from "./lib/routes.mjs";

const origin = "https://felipebasurto.com";
const errors = [];
let links = 0;

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

function checkLink(value, from) {
  if (!value || value.startsWith("#")) return;
  const url = new URL(value.replaceAll("&amp;", "&"), `${origin}/${from}`);
  if (url.origin !== origin) return;
  links++;
  const path = join(DIST, decodeURIComponent(url.pathname));
  if (!existsSync(path) && !existsSync(join(path, "index.html"))) {
    errors.push(`${from}: missing ${url.pathname}`);
  }
}

const routes = [
  "/", "/404.html", "/projects/", "/triplecheck/", "/blog/", "/musatro/", "/experience/cursor/",
  ...LANDING_PAGES.map((page) => `/${page.slug}/`),
  ...detailPages().map((page) => `/experience/${page.slug}/`),
];
for (const route of routes) checkLink(route, "index.html");

const files = filesIn(DIST);
for (const file of files) {
  const name = relative(DIST, file);
  if (file.endsWith(".html")) {
    const html = readFileSync(file, "utf8");
    assert(!/\{\{[A-Z_]+\}\}/.test(html), `${name}: unresolved build token`);
    for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
      for (const attr of tag[0].matchAll(/\b(?:href|src|poster|data-trace|data-sprites)="([^"]*)"/gi)) {
        checkLink(attr[1], name);
      }
    }
  } else if (file.endsWith(".css")) {
    for (const match of readFileSync(file, "utf8").matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      checkLink(match[1], name);
    }
  }
}

const sitemap = readFileSync(join(DIST, "sitemap.xml"), "utf8");
for (const match of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)) checkLink(match[1], "sitemap.xml");
const listings = ["sitemap.xml", "blog/feed.xml", "blog/index.md", "llms.txt"];
for (const file of readdirSync(join(ROOT, "content", "blog"))) {
  if (!file.endsWith(".md")) continue;
  const source = readFileSync(join(ROOT, "content", "blog", file), "utf8");
  if (!/^draft:\s*true\s*$/m.test(source)) continue;
  const slug = file.slice(0, -3);
  for (const listing of listings) {
    assert(!readFileSync(join(DIST, listing), "utf8").includes(`/blog/${slug}`), `${listing}: draft ${slug} leaked`);
  }
  if (process.env.BLOG_DRAFTS !== "1") {
    assert(!existsSync(join(DIST, "blog", slug)), `Draft ${slug} was published`);
    assert(!existsSync(join(DIST, "blog", file)), `Draft Markdown ${slug} was published`);
    assert(!readFileSync(join(DIST, "blog", "index.html"), "utf8").includes(`/blog/${slug}/`), `Draft ${slug} listed`);
  }
}

assert(!files.some((file) => /^(?:content|src|scripts)\//.test(relative(DIST, file))), "Build sources were published");
assert.deepEqual(errors, [], "Broken internal links");
console.log(`Verified ${routes.length} routes, ${links} local links/assets, and draft publication boundaries.`);
