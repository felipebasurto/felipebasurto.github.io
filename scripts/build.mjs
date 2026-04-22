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
  return /^https?:\/\//i.test(href);
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
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
      return `<strong class="md-strong"><span class="md-muted">**</span>${text}<span class="md-muted">**</span></strong>`;
    },
    em(text) {
      return `<em class="md-em"><span class="md-muted">_</span>${text}<span class="md-muted">_</span></em>`;
    },
    image(href, title, text) {
      const safe = escapeAttr(href);
      const alt = escapeAttr(text);
      const t = title ? ` title="${escapeAttr(title)}"` : "";
      const isLogo = /\/assets\/companies\//.test(href);
      if (isLogo) {
        return `<img class="md-logo" src="${safe}" alt="${alt}"${t} loading="lazy" width="20" height="20" />`;
      }
      const caption = `![${text}](${href})`;
      return `<figure class="md-figure"><img class="md-img" src="${safe}" alt="${alt}"${t} loading="lazy" width="112" height="112" /><figcaption class="md-figcap">${escapeHtml(caption)}</figcaption></figure>\n`;
    },
  },
});

function loadTemplate() {
  return readFileSync(join(root, "scripts", "template.html"), "utf8");
}

function unwrapFigures(html) {
  let out = html.replace(
    /<p class="md-p">\s*<figure class="md-figure">/g,
    '<figure class="md-figure">'
  );
  out = out.replace(/<\/figure>\s*<\/p>/g, "</figure>");
  return out;
}

function renderMarkdownBody(body) {
  return unwrapFigures(marked.parse(body));
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
      const fn = await downloadImageTo(im.url, assetDir, im.name);
      if (fn) ev._imageFiles.push(fn);
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

function renderCursorJumpNav(events) {
  let html = '<nav class="ev-jump" aria-label="On this page"><span class="ev-jump__label">On this page</span>';
  for (const ev of events) {
    const short = String(ev.title).replace(/\s*\([^)]*\)\s*$/, "");
    html += `<a class="ev-jump__a" href="#${escapeAttr(ev.id)}">${escapeHtml(short)}</a>`;
  }
  html += "</nav>\n";
  return html;
}

function renderCursorTimeline(events, imgRelBase) {
  let html =
    '<section class="ev-wrap" aria-label="Events timeline">\n' +
    renderCursorJumpNav(events) +
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
      for (const fn of files) {
        const href = `${imgRelBase}${fn}`;
        html += `<a class="ev-shot" href="${escapeAttr(href)}">\n`;
        html += `<img src="${escapeAttr(href)}" alt="" loading="lazy" decoding="async" width="640" height="400" />\n`;
        html += "</a>\n";
      }
      html += "</div>\n";
    }
    html += "</article>\n</li>\n";
  }
  html += "</ol></section>\n";
  return html;
}

async function buildCursorExperiencePage(data) {
  const assetDir = join(root, "assets", "experience", "cursor");
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

function buildJsonLd() {
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Felipe Basurto",
    jobTitle: "Solutions Architect",
    description:
      "Solutions Architect at Multiverse Computing working on LLM compression (CompactifAI). Cursor Madrid Ambassador. Based in Madrid.",
    image: `${SITE}/assets/profile.png`,
    url: SITE,
    sameAs: [
      "https://github.com/felipebasurto",
      "https://www.linkedin.com/in/felipe-basurto-barrio/",
      "https://twitter.com/BasurtoBarrio",
    ],
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "IE School of Science and Technology" },
      { "@type": "CollegeOrUniversity", name: "Universidad de Burgos" },
    ],
    worksFor: { "@type": "Organization", name: "Multiverse Computing" },
  };
  return JSON.stringify(person);
}

function buildWebPageJsonLd({ name, url, description }) {
  return JSON.stringify({
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
    jsonLd: buildJsonLd(),
    docClass: "",
    articleClass: "",
  });
  writeFileSync(join(root, "index.html"), html, "utf8");
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
    const data = JSON.parse(readFileSync(cursorJsonPath, "utf8"));
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
      docClass: "",
      articleClass: "",
    });
    writeFileSync(join(outDir, "index.html"), html, "utf8");
  }
}

async function main() {
  buildIndex();
  await buildExperiencePages();
  console.log("Build OK: index.html + experience/*");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
