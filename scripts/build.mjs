import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SITE = "https://felipebasurto.com";

const FETCH_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, "&#96;");
}

/** Prevent `</script>` in JSON strings from closing the script tag. */
function toSafeJsonLdString(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function slugify(text) {
  return stripTags(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { meta: {}, body: raw };
  }
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) {
    return { meta: {}, body: raw };
  }
  const yamlBlock = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const meta = {};
  for (const line of yamlBlock.split("\n")) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[m[1]] = v;
  }
  return { meta, body };
}

function isExternalHref(href) {
  return /^https?:\/\//i.test(href) || href.startsWith("//");
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    html(html) {
      return escapeHtml(html ?? "");
    },
    heading(text, level, _raw) {
      const hashes = "#".repeat(level);
      const id = slugify(text);
      return `<h${level} class="md-heading" id="${escapeAttr(id)}"><span class="md-hashes" aria-hidden="true">${hashes}</span> ${text}</h${level}>\n`;
    },
    link(href, title, text) {
      const safeHref = escapeAttr(href);
      const tip = title || href;
      const titleAttr = ` title="${escapeAttr(tip)}"`;
      const external = isExternalHref(href)
        ? ` rel="noopener noreferrer" target="_blank"`
        : "";
      // Text-only links: keep reading flow; full URL in native tooltip via title.
      return `<a class="md-link" href="${safeHref}"${titleAttr}${external}>${text}</a>`;
    },
    paragraph(text) {
      return `<p class="md-p">${text}</p>\n`;
    },
    list(body, ordered, start) {
      const tag = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 && start !== "" ? ` start="${start}"` : "";
      const cls = ordered ? "md-list md-list--ordered" : "md-list md-list--unordered";
      return `<${tag} class="${cls}"${startAttr}>\n${body}</${tag}>\n`;
    },
    listitem(text, task, checked) {
      if (task) {
        const box = checked ? "[x]" : "[ ]";
        return `<li class="md-li md-li--task"><span class="md-task">${box}</span> ${text}</li>\n`;
      }
      return `<li class="md-li">${text}</li>\n`;
    },
    code(code, infostring) {
      const lang = infostring ? escapeAttr(infostring) : "";
      const fence = "```";
      const label = lang ? `${fence}${lang}` : fence;
      return `<div class="md-codeblock"><div class="md-codeblock-gutter" aria-hidden="true">${escapeHtml(label)}</div><pre class="md-pre"><code class="md-code${lang ? ` language-${lang}` : ""}">${escapeHtml(code)}</code></pre></div>\n`;
    },
    codespan(code) {
      return `<code class="md-codespan"><span class="md-muted">\`</span>${escapeHtml(code)}<span class="md-muted">\`</span></code>`;
    },
    blockquote(quote) {
      return `<blockquote class="md-bq">\n${quote}</blockquote>\n`;
    },
    hr() {
      return `<p class="md-hr-line" aria-hidden="true">---</p>\n<hr class="md-hr" />\n`;
    },
    strong(text) {
      return `<strong class="md-strong">${text}</strong>`;
    },
    em(text) {
      return `<em class="md-em">${text}</em>`;
    },
    image(href, title, text) {
      const safe = escapeAttr(href);
      const alt = escapeAttr(text);
      const t = title ? ` title="${escapeAttr(title)}"` : "";
      const isLogo = /\/assets\/companies\//.test(href);
      if (isLogo) {
        return `<img class="md-logo" src="${safe}" alt="${alt}"${t} loading="lazy" width="20" height="20" />`;
      }
      if (/\/assets\/experience\/habitdex\/habitdex-icon\./i.test(href)) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--appicon"><img class="md-img md-img--appicon" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="96" height="96" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      const isAppStoreShot = /\/assets\/experience\/(encore|habitdex)\//.test(href);
      if (isAppStoreShot) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--appshot"><img class="md-img md-img--appshot" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="300" height="650" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      if (/\/assets\/triplecheck\//.test(href)) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--triplecheck"><img class="md-img md-img--triplecheck" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="1200" height="800" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      const caption = `![${text}](${href})`;
      return `<figure class="md-figure"><img class="md-img" src="${safe}" alt="${alt}"${t} loading="lazy" width="112" height="112" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
    },
  },
});

function loadTemplate() {
  return readFileSync(join(root, "scripts", "template.html"), "utf8");
}

function unwrapFigures(html) {
  let out = html;
  const openPatterns = [
    /<p class="md-p">\s*<figure class="md-figure md-figure--appshot">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--appicon">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--triplecheck">/g,
    /<p class="md-p">\s*<figure class="md-figure">/g,
  ];
  for (const re of openPatterns) {
    out = out.replace(re, (m) => m.replace(/<p class="md-p">\s*/, ""));
  }
  out = out.replace(/<\/figure>\s*<\/p>/g, "</figure>");
  return out;
}

/** Wrap consecutive App Store figures in a responsive grid (Encore, HabitDex, etc.). */
function wrapAppShotGrids(html) {
  return html.replace(
    /(?:<figure class="md-figure md-figure--appshot">[\s\S]*?<\/figure>(?:\s*\n*)?)+/g,
    (block) => `<div class="md-appshot-grid">\n${block.trim()}\n</div>\n`
  );
}

function renderMarkdownBody(body) {
  return wrapAppShotGrids(unwrapFigures(marked.parse(body)));
}

function absOgImage(ogImage) {
  return ogImage.startsWith("http") ? ogImage : `${SITE}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;
}

function fillTemplate({
  title,
  description,
  ogImageAbs,
  canonicalUrl,
  ogUrl,
  relPrefix,
  headerHint,
  bodyHtml,
  jsonLd,
  docClass = "",
  articleClass = "",
}) {
  let html = loadTemplate();
  html = html.replaceAll("{{TITLE}}", escapeHtml(title));
  html = html.replaceAll("{{DESCRIPTION}}", escapeHtml(description));
  html = html.replaceAll("{{OG_IMAGE}}", escapeAttr(ogImageAbs));
  html = html.replaceAll("{{CANONICAL}}", escapeAttr(canonicalUrl));
  html = html.replaceAll("{{OG_URL}}", escapeAttr(ogUrl));
  html = html.replaceAll("{{REL_PREFIX}}", relPrefix);
  html = html.replaceAll("{{HEADER_HINT}}", escapeHtml(headerHint));
  html = html.replaceAll("{{BODY}}", bodyHtml);
  html = html.replaceAll("{{JSON_LD}}", jsonLd);
  html = html.replaceAll("{{DOC_CLASS}}", docClass);
  html = html.replaceAll("{{ARTICLE_CLASS}}", articleClass);
  html = html.replaceAll("{{YEAR}}", String(new Date().getFullYear()));
  return html;
}

async function downloadImageTo(url, dir, baseName) {
  mkdirSync(dir, { recursive: true });
  const res = await fetch(url, {
    headers: { "User-Agent": FETCH_UA, Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
  });
  if (!res.ok) {
    console.warn(`Image skip (${res.status}): ${baseName}`);
    return null;
  }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  let ext = ".jpg";
  if (ct.includes("png")) ext = ".png";
  if (ct.includes("webp")) ext = ".webp";
  const filename = `${baseName}${ext}`;
  const full = join(dir, filename);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(full, buf);
  return filename;
}

async function hydrateCursorImages(events, assetDir) {
  for (const ev of events) {
    ev._imageFiles = [];
    for (const im of ev.images || []) {
      if (im.static) {
        const fn = String(im.static).replace(/[/\\]/g, "");
        const full = join(assetDir, fn);
        if (!existsSync(full)) {
          console.warn(`cursor.json: static image missing (${fn}) for event "${ev.id}"`);
        } else {
          const idx = ev._imageFiles.length + 1;
          const altRaw =
            im.alt != null && String(im.alt).trim() !== ""
              ? String(im.alt)
              : `${ev.title} — photo ${idx}`;
          ev._imageFiles.push({ fn, alt: altRaw });
        }
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      const fn = await downloadImageTo(im.url, assetDir, im.name);
      if (fn) {
        const idx = ev._imageFiles.length + 1;
        const altRaw =
          im.alt != null && String(im.alt).trim() !== ""
            ? String(im.alt)
            : `${ev.title} — photo ${idx}`;
        ev._imageFiles.push({ fn, alt: altRaw });
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

function renderCursorTimeline(events, imgRelBase) {
  let html =
    '<section class="ev-wrap" aria-label="Events timeline">\n' +
    '<ol class="ev-timeline">\n';
  for (const ev of events) {
    html += `<li class="ev-item" id="${escapeAttr(ev.id)}">\n`;
    html += '<article class="ev-card">\n';
    html += '<header class="ev-head">\n';
    html += `<span class="ev-date">${escapeHtml(ev.date)}</span>\n`;
    html += `<h2 class="ev-title">${escapeHtml(ev.title)}</h2>\n`;
    html += "</header>\n";
    html += `<div class="ev-copy">${unwrapFigures(marked.parse(ev.body_md))}</div>\n`;
    const files = ev._imageFiles || [];
    if (files.length) {
      html += '<div class="ev-grid">\n';
      for (const shot of files) {
        const href = `${imgRelBase}${shot.fn}`;
        html += `<a class="ev-shot" href="${escapeAttr(href)}">\n`;
        html += `<img src="${escapeAttr(href)}" alt="${escapeAttr(shot.alt)}" loading="lazy" decoding="async" width="640" height="400" />\n`;
        html += "</a>\n";
      }
      html += "</div>\n";
    }
    html += "</article>\n</li>\n";
  }
  html += "</ol></section>\n";
  return html;
}

function warnDuplicateCursorImageUrls(data) {
  const seen = new Map();
  for (const ev of data.events || []) {
    for (const im of ev.images || []) {
      const u = im.url;
      if (!u) continue;
      if (seen.has(u)) {
        console.warn(
          `cursor.json: same image URL used in "${seen.get(u)}" and "${ev.id}" — photos will duplicate across events.`
        );
      } else {
        seen.set(u, ev.id);
      }
    }
  }
}

async function buildCursorExperiencePage(data) {
  const assetDir = join(root, "assets", "experience", "cursor");
  warnDuplicateCursorImageUrls(data);
  await hydrateCursorImages(data.events, assetDir);
  const imgRel = "../../assets/experience/cursor/";
  const introHtml = renderMarkdownBody(data.intro_md);
  const timelineHtml = renderCursorTimeline(data.events, imgRel);
  const bodyHtml = `${introHtml}\n${timelineHtml}`;
  const title = data.title || "Cursor Madrid";
  const description = data.description || "";
  const ogImage = data.og_image || "/assets/companies/cursor.png";
  const ogImageAbs = absOgImage(ogImage);
  const slug = "cursor";
  const path = `/experience/${slug}/`;
  const canonicalUrl = `${SITE}${path}`;
  const outDir = join(root, "experience", slug);
  mkdirSync(outDir, { recursive: true });
  const html = fillTemplate({
    title,
    description,
    ogImageAbs,
    canonicalUrl,
    ogUrl: canonicalUrl,
    relPrefix: "../../",
    headerHint: "~/experience/cursor.json",
    bodyHtml,
    jsonLd: buildWebPageJsonLd({ name: title, url: canonicalUrl, description }),
    docClass: " doc--wide",
    articleClass: " md-doc--cursor",
  });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
}

function buildJsonLd(description) {
  const personId = `${SITE}/#person`;
  const websiteId = `${SITE}/#website`;
  const person = {
    "@type": "Person",
    "@id": personId,
    name: "Felipe Basurto",
    jobTitle: "Solutions Architect",
    description,
    image: `${SITE}/assets/profile.png`,
    url: SITE,
    sameAs: [
      "https://github.com/felipebasurto",
      "https://www.linkedin.com/in/felipe-basurto-barrio/",
      "https://x.com/fildotai",
    ],
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "IE School of Science and Technology" },
      { "@type": "CollegeOrUniversity", name: "Universidad de Burgos" },
    ],
    worksFor: {
      "@type": "Organization",
      name: "Multiverse Computing",
      url: "https://multiversecomputing.com/",
    },
    memberOf: {
      "@type": "MusicGroup",
      name: "Triple Check",
      url: "https://open.spotify.com/artist/2uGutUfLOfafsa8NLUjdzR",
      genre: "Spanish pop rock",
    },
    homeLocation: {
      "@type": "Place",
      name: "Madrid, Spain",
    },
    nationality: {
      "@type": "Country",
      name: "Spain",
    },
    knowsLanguage: ["en", "es"],
    knowsAbout: [
      "LLM compression",
      "CompactifAI",
      "solutions engineering",
      "applied AI",
      "Graph RAG",
      "Neo4j",
      "LangChain",
      "Langfuse",
      "MLOps",
      "AWS",
      "Apache Airflow",
      "Python",
      "machine learning",
      "computer vision",
      "pre-sales engineering",
      "Swift",
      "SwiftUI",
      "hobby iOS",
      "Triple Check",
      "Spanish pop rock",
    ],
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE}/`,
      url: SITE,
    },
  };
  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    url: SITE,
    name: "Felipe Basurto",
    description,
    inLanguage: "en",
    publisher: { "@id": personId },
  };
  return toSafeJsonLdString({
    "@context": "https://schema.org",
    "@graph": [person, website],
  });
}

function buildWebPageJsonLd({ name, url, description }) {
  return toSafeJsonLdString({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    url,
    description,
    isPartOf: { "@type": "WebSite", name: "Felipe Basurto", url: SITE },
  });
}

function buildIndex() {
  const rawMd = readFileSync(join(root, "content", "cv.md"), "utf8");
  const { meta, body } = parseFrontmatter(rawMd);
  const title = meta.title || "Felipe Basurto";
  const description =
    meta.description ||
    "Data Scientist and ML Engineer — NLP, machine learning, and AI for business intelligence.";
  const ogImage = meta.og_image || "/assets/profile.png";
  const ogImageAbs = absOgImage(ogImage);
  const bodyHtml = renderMarkdownBody(body);
  const html = fillTemplate({
    title,
    description,
    ogImageAbs,
    canonicalUrl: `${SITE}/`,
    ogUrl: `${SITE}/`,
    relPrefix: "./",
    headerHint: "~/cv.md",
    bodyHtml,
    jsonLd: buildJsonLd(description),
    docClass: "",
    articleClass: "",
  });
  writeFileSync(join(root, "index.html"), html, "utf8");
}

function buildProjectsPage() {
  const mdPath = join(root, "content", "projects.md");
  if (!existsSync(mdPath)) return;
  const raw = readFileSync(mdPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const title = meta.title || "Projects — Felipe Basurto";
  const description = meta.description || "Shipped apps and GitHub projects.";
  const ogImage = meta.og_image || "/assets/profile.png";
  const ogImageAbs = absOgImage(ogImage);
  const canonicalUrl = `${SITE}/projects/`;
  const bodyHtml = renderMarkdownBody(body);
  const outDir = join(root, "projects");
  mkdirSync(outDir, { recursive: true });
  const html = fillTemplate({
    title,
    description,
    ogImageAbs,
    canonicalUrl,
    ogUrl: canonicalUrl,
    relPrefix: "../",
    headerHint: "~/projects.md",
    bodyHtml,
    jsonLd: buildWebPageJsonLd({ name: title, url: canonicalUrl, description }),
    docClass: "",
    articleClass: "",
  });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
}

function buildTriplecheckPage() {
  const mdPath = join(root, "content", "triplecheck.md");
  if (!existsSync(mdPath)) return;
  const raw = readFileSync(mdPath, "utf8");
  let { meta, body } = parseFrontmatter(raw);
  const yt = meta.youtube != null ? String(meta.youtube).trim() : "";
  if (yt) {
    body = body.replaceAll("__YOUTUBE__", yt);
  } else {
    body = body.replace(/\r?\n- \*\*YouTube:\*\* \[[^\]]+\]\(__YOUTUBE__\)/g, "");
  }
  const title = meta.title || "Triple Check — Felipe Basurto";
  const description =
    meta.description || "Triple Check — Spanish pop rock from Burgos: discography, streaming milestones, and story.";
  const ogImage = meta.og_image || "/assets/triplecheck/atentamente-ep.png";
  const ogImageAbs = absOgImage(ogImage);
  const canonicalUrl = `${SITE}/triplecheck/`;
  const bodyHtml = renderMarkdownBody(body);
  const outDir = join(root, "triplecheck");
  mkdirSync(outDir, { recursive: true });
  const html = fillTemplate({
    title,
    description,
    ogImageAbs,
    canonicalUrl,
    ogUrl: canonicalUrl,
    relPrefix: "../",
    headerHint: "~/triplecheck.md",
    bodyHtml,
    jsonLd: buildWebPageJsonLd({ name: title, url: canonicalUrl, description }),
    docClass: " doc--wide",
    articleClass: " md-doc--triplecheck",
  });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
}

async function buildExperiencePages() {
  const expDir = join(root, "content", "experience");
  let files;
  try {
    files = readdirSync(expDir);
  } catch {
    return;
  }
  const cursorJsonPath = join(expDir, "cursor.json");
  if (existsSync(cursorJsonPath)) {
    let data;
    try {
      data = JSON.parse(readFileSync(cursorJsonPath, "utf8"));
    } catch (err) {
      console.error(`Failed to parse JSON: ${cursorJsonPath}`);
      throw err;
    }
    await buildCursorExperiencePage(data);
  }
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(/\.md$/i, "");
    if (slug === "cursor" && existsSync(cursorJsonPath)) continue;
    const raw = readFileSync(join(expDir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const title = meta.title || slug;
    const description = meta.description || "";
    const ogImage = meta.og_image || "/assets/profile.png";
    const ogImageAbs = absOgImage(ogImage);
    const path = `/experience/${slug}/`;
    const canonicalUrl = `${SITE}${path}`;
    const bodyHtml = renderMarkdownBody(body);
    const outDir = join(root, "experience", slug);
    mkdirSync(outDir, { recursive: true });
    const html = fillTemplate({
      title,
      description,
      ogImageAbs,
      canonicalUrl,
      ogUrl: canonicalUrl,
      relPrefix: "../../",
      headerHint: `~/experience/${slug}.md`,
      bodyHtml,
      jsonLd: buildWebPageJsonLd({ name: title, url: canonicalUrl, description }),
      docClass: slug === "encore" || slug === "habitdex" ? " doc--wide" : "",
      articleClass: slug === "encore" || slug === "habitdex" ? ` md-doc--${slug}` : "",
    });
    writeFileSync(join(outDir, "index.html"), html, "utf8");
  }
}

function getExperienceSlugsForSitemap() {
  const expDir = join(root, "content", "experience");
  const slugs = [];
  if (!existsSync(expDir)) return slugs;
  const files = readdirSync(expDir);
  const hasCursorJson = existsSync(join(expDir, "cursor.json"));
  if (hasCursorJson) slugs.push("cursor");
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(/\.md$/i, "");
    if (slug === "cursor" && hasCursorJson) continue;
    slugs.push(slug);
  }
  slugs.sort((a, b) => a.localeCompare(b));
  return slugs;
}

function writeSitemap() {
  const lastmod = new Date().toISOString().slice(0, 10);
  const slugs = getExperienceSlugsForSitemap();
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  const pushUrl = (loc, priority) => {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(loc)}</loc>`);
    lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
    lines.push("    <changefreq>monthly</changefreq>");
    lines.push(`    <priority>${priority}</priority>`);
    lines.push("  </url>");
  };
  pushUrl(`${SITE}/`, "1.0");
  if (existsSync(join(root, "content", "projects.md"))) {
    pushUrl(`${SITE}/projects/`, "0.75");
  }
  if (existsSync(join(root, "content", "triplecheck.md"))) {
    pushUrl(`${SITE}/triplecheck/`, "0.7");
  }
  for (const slug of slugs) {
    pushUrl(`${SITE}/experience/${slug}/`, "0.7");
  }
  lines.push("</urlset>");
  lines.push("");
  writeFileSync(join(root, "sitemap.xml"), lines.join("\n"), "utf8");
}

async function main() {
  buildIndex();
  buildProjectsPage();
  buildTriplecheckPage();
  await buildExperiencePages();
  writeSitemap();
  console.log("Build OK: index.html + projects/* + triplecheck/* + experience/* + sitemap.xml");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
