import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import hljs from "highlight.js/lib/common";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SITE = "https://felipebasurto.com";
const DEFAULT_OG_IMAGE = "/assets/og.png";

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

/** Minimum highlight.js auto-detection relevance before an unlabeled block is coloured. */
const AUTO_HIGHLIGHT_MIN_RELEVANCE = 5;

/** Highlight at build time; the page ships plain spans styled by .hljs-* rules in styles.css. */
const PROJECTION_HEADER_RE = /^[\w./-]+:(?:symbol|region|file):\d+bytes$/;

function highlightCode(code, lang) {
  const language = String(lang ?? "").trim().split(/\s+/)[0];
  if (language && hljs.getLanguage(language)) {
    const [first, ...rest] = code.split("\n");
    if (PROJECTION_HEADER_RE.test(first)) {
      return `<span class="hljs-meta">${escapeHtml(first)}</span>\n${hljs.highlight(rest.join("\n"), { language, ignoreIllegals: true }).value}`;
    }
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  }
  if (!language) {
    const auto = hljs.highlightAuto(code);
    if (auto.relevance >= AUTO_HIGHLIGHT_MIN_RELEVANCE) return auto.value;
  }
  return escapeHtml(code);
}

/** Pass through <details>/<summary> only; escape any other raw HTML. */
function renderSafeDetailsHtml(raw) {
  const text = String(raw ?? "");
  if (!/<\/?(?:details|summary)\b/i.test(text)) {
    return escapeHtml(text);
  }
  const safe = text.replace(/<\/?(?:details|summary)(\s[^>]*)?>/gi, (tag) => {
    const close = tag.startsWith("</");
    const name = /details/i.test(tag) ? "details" : "summary";
    if (close) return `</${name}>`;
    if (name === "details") return '<details class="md-details">';
    return '<summary class="md-details__summary">';
  });
  if (/<(?!\/?(?:details|summary)\b)/i.test(safe)) {
    return escapeHtml(text);
  }
  return safe;
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    html(html) {
      const raw = typeof html === "string" ? html : (html?.text ?? "");
      return renderSafeDetailsHtml(raw);
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
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const lines = String(code ?? "").split("\n");
      const hasEmail = lines.some((line) => emailRe.test(line));
      const contactClass = !infostring && hasEmail ? " md-codeblock--contact" : "";
      const inner = contactClass
        ? lines
            .map((line) =>
              emailRe.test(line)
                ? `<a class="md-link" href="mailto:${escapeAttr(line)}" title="mailto:${escapeAttr(line)}">${escapeHtml(line)}</a>`
                : escapeHtml(line),
            )
            .join("\n")
        : highlightCode(String(code ?? ""), infostring);
      return `<div class="md-codeblock${contactClass}"><div class="md-codeblock-gutter" aria-hidden="true">${escapeHtml(label)}</div><pre class="md-pre"><code class="md-code${lang ? ` language-${lang}` : ""}">${inner}</code></pre></div>\n`;
    },
    codespan(code) {
      // A bracketed hex ID such as `[a1237d48]` is a FreshCtx marker; the blog colors those.
      const marker = /^\[[0-9a-f]{8,}\]$/.test(code) ? " md-marker" : "";
      return `<code class="md-codespan${marker}"><span class="md-muted">\`</span>${code}<span class="md-muted">\`</span></code>`;
    },
    blockquote(quote) {
      return `<blockquote class="md-bq">\n${quote}</blockquote>\n`;
    },
    table(header, body) {
      return `<div class="md-table-wrap"><table class="md-table">\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table></div>\n`;
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
      if (/\/assets\/experience\/(habitdex\/habitdex-icon|audio-silence-remover\/icon|musatro\/icon)\./i.test(href)) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--appicon"><img class="md-img md-img--appicon" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="96" height="96" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      if (/\/assets\/experience\/audio-silence-remover\/screenshot\./i.test(href)) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--macshot"><img class="md-img md-img--macshot" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="1200" height="750" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      if (/\/assets\/experience\/musatro\/(?!icon\.)/i.test(href)) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--gameshot"><img class="md-img md-img--gameshot" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="1400" height="875" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      const isAppStoreShot = /\/assets\/experience\/(encore|habitdex)\//.test(href);
      if (isAppStoreShot) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--appshot"><img class="md-img md-img--appshot" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="300" height="650" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      if (/\/assets\/blog\//.test(href)) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--post"><img class="md-img md-img--post" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="1600" height="900" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      if (/\/assets\/triplecheck\//.test(href)) {
        const caption = `![${text}](${href})`;
        return `<figure class="md-figure md-figure--triplecheck"><img class="md-img md-img--triplecheck" src="${safe}" alt="${alt}"${t} loading="lazy" decoding="async" width="1200" height="800" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
      }
      const caption = `![${text}](${href})`;
      const isProfile = /(?:^|\/)assets\/profile\.(png|jpe?g|webp)$/i.test(href);
      const load = isProfile
        ? ` fetchpriority="high" decoding="async"`
        : ` loading="lazy"`;
      return `<figure class="md-figure"><img class="md-img" src="${safe}" alt="${alt}"${t}${load} width="112" height="112" /><figcaption class="md-figcap" aria-hidden="true">${escapeHtml(caption)}</figcaption></figure>\n`;
    },
  },
});

function loadTemplate() {
  return readFileSync(join(root, "scripts", "template.html"), "utf8");
}

/** Content hash appended to the stylesheet URL so browsers refetch it after a change. */
const CSS_VERSION = createHash("sha256")
  .update(readFileSync(join(root, "css", "styles.css")))
  .digest("hex")
  .slice(0, 10);

function unwrapFigures(html) {
  let out = html;
  const openPatterns = [
    /<p class="md-p">\s*<figure class="md-figure md-figure--appshot">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--appicon">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--macshot">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--gameshot">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--triplecheck">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--post">/g,
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

function wrapGameShotGrids(html) {
  return html.replace(
    /(?:<figure class="md-figure md-figure--gameshot">[\s\S]*?<\/figure>(?:\s*\n*)?)+/g,
    (block) => `<div class="md-gameshot-grid">\n${block.trim()}\n</div>\n`
  );
}

const GENERIC_LINK_TEXTS = new Set(["Details", "App Store", "GitHub", "Play", "Spotify", "PyPI", "Site", "Research notes", "Event", "Email me"]);

/** Give repeated link labels ("Details", "App Store", ...) an aria-label naming the row's subject. */
function labelGenericLinks(html) {
  return html.replace(/<(li|p) class="md-(?:li|p)">[\s\S]*?<\/\1>/g, (block) => {
    const links = [...block.matchAll(/<a class="md-link"[^>]*>([\s\S]*?)<\/a>/g)];
    if (!links.some((m) => GENERIC_LINK_TEXTS.has(stripTags(m[1])))) return block;
    const subjectLink = links.find((m) => !GENERIC_LINK_TEXTS.has(stripTags(m[1])));
    const strong = block.match(/<strong class="md-strong">([\s\S]*?)<\/strong>/);
    const subject = stripTags(subjectLink?.[1] ?? strong?.[1] ?? "").replace(/[.:]+$/, "");
    if (!subject) return block;
    return block.replace(/<a class="md-link"([^>]*)>([\s\S]*?)<\/a>/g, (link, attrs, text) => {
      const label = stripTags(text);
      if (!GENERIC_LINK_TEXTS.has(label)) return link;
      return `<a class="md-link"${attrs} aria-label="${escapeAttr(`${label}: ${subject}`)}">${text}</a>`;
    });
  });
}

export function renderMarkdownBody(body) {
  return labelGenericLinks(wrapGameShotGrids(wrapAppShotGrids(unwrapFigures(marked.parse(body)))));
}

function loadProjects() {
  return JSON.parse(readFileSync(join(root, "content", "projects.json"), "utf8"));
}

function projectHref(href, relPrefix) {
  return isExternalHref(href) || href.startsWith("mailto:") ? href : `${relPrefix}${href}`;
}

function renderProjectLink({ label, href }, subject, relPrefix) {
  const url = projectHref(href, relPrefix);
  const external = isExternalHref(url) ? ` rel="noopener noreferrer" target="_blank"` : "";
  const aria = GENERIC_LINK_TEXTS.has(label) ? ` aria-label="${escapeAttr(`${label}: ${subject}`)}"` : "";
  return `<a class="md-link" href="${escapeAttr(url)}" title="${escapeAttr(url)}"${external}${aria}>${escapeHtml(label)}</a>`;
}

const LINK_SEP = ' <span class="md-muted" aria-hidden="true">·</span> ';

function renderProjectLinks(item, relPrefix) {
  return (item.links ?? []).map((l) => renderProjectLink(l, item.name, relPrefix)).join(LINK_SEP);
}

/** Home page: one line per featured project, in the same shape as the Experience rows. */
function renderFeaturedProjects(relPrefix) {
  const items = loadProjects()
    .groups.flatMap((group) => group.items)
    .filter((item) => item.featured)
    .map((item) => {
      const icon = item.icon
        ? `<img class="md-logo" src="${escapeAttr(relPrefix + item.icon)}" alt="" loading="lazy" width="20" height="20" />`
        : "";
      const name = renderProjectLink({ label: item.name, href: item.href }, item.name, relPrefix);
      return `<li class="md-li">${icon}${name}. ${escapeHtml(item.tagline)}. ${renderProjectLinks(item, relPrefix)}</li>`;
    })
    .join("\n");
  const all = renderProjectLink({ label: "All projects, experiments, and university work", href: "projects/" }, "", relPrefix);
  return `<ul class="md-list md-list--unordered">\n${items}\n</ul>\n<p class="md-p">${all}</p>\n`;
}

function renderTreeLabel(item) {
  return `<span class="tree__name">${escapeHtml(item.slug)}</span><span class="tree__tagline">${escapeHtml(item.tagline)}</span>`;
}

function renderTreeItem(item, relPrefix) {
  const meta = [item.status && `[${item.status}]`, item.year, ...(item.stack ?? [])]
    .filter(Boolean)
    .map((s) => escapeHtml(s))
    .join(LINK_SEP);
  const links = renderProjectLinks(item, relPrefix);
  const icon = item.icon
    ? `<img class="md-logo" src="${escapeAttr(relPrefix + item.icon)}" alt="" loading="lazy" width="20" height="20" />`
    : "";
  return `<li class="tree__node"><details class="tree__item">
<summary class="tree__summary">${renderTreeLabel(item)}</summary>
<div class="tree__panel">
<p class="tree__meta">${icon}<strong class="md-strong">${escapeHtml(item.name)}</strong>${meta ? `${LINK_SEP}${meta}` : ""}</p>
<p class="tree__text">${marked.parseInline(item.summary_md)}</p>
${links ? `<p class="tree__links">${links}</p>\n` : ""}</div>
</details></li>`;
}

function renderTreeLink(item, relPrefix) {
  const url = projectHref(item.href, relPrefix);
  return `<li class="tree__node"><a class="tree__link" href="${escapeAttr(url)}" title="${escapeAttr(url)}" rel="noopener noreferrer" target="_blank">${renderTreeLabel(item)}</a></li>`;
}

/** /projects/: a `tree`-style listing. Folders and projects are <details>; links stay out of <summary>. */
function renderProjectTree(relPrefix) {
  const folders = loadProjects()
    .groups.map((group) => {
      const render = group.layout === "links" ? renderTreeLink : renderTreeItem;
      const items = group.items.map((item) => render(item, relPrefix)).join("\n");
      return `<li class="tree__node"><details class="tree__folder"${group.collapsed ? "" : " open"}>
<summary class="tree__summary"><span class="tree__name tree__name--folder">${escapeHtml(group.name)}/</span><span class="tree__count">${group.items.length}</span></summary>
<ul class="tree__list">
${items}
</ul>
</details></li>`;
    })
    .join("\n");
  return `<div class="tree">
<p class="tree__root" aria-hidden="true">~/projects</p>
<ul class="tree__list">
${folders}
</ul>
</div>\n`;
}

/** Home page: latest post under ## Blog, plus the index. Renders nothing until a post exists. */
function renderBlogLink(relPrefix) {
  const [latest] = loadBlogPosts();
  if (!latest) return "";
  const post = renderProjectLink({ label: latest.title, href: `blog/${latest.slug}/` }, "", relPrefix);
  const all = renderProjectLink({ label: "All posts", href: "blog/" }, "", relPrefix);
  const lead = latest.summary || latest.description.split(/(?<=\.)\s/)[0];
  return `<ul class="md-list md-list--unordered">\n<li class="md-li">${post}. ${escapeHtml(lead)}</li>\n</ul>\n<p class="md-p">${all}</p>\n`;
}

const PROJECT_TOKENS = {
  "{{PROJECTS_FEATURED}}": renderFeaturedProjects,
  "{{PROJECTS_TREE}}": renderProjectTree,
  "{{BLOG_LINK}}": renderBlogLink,
};

function renderPageBody(body, relPrefix) {
  let html = renderMarkdownBody(body);
  for (const [token, render] of Object.entries(PROJECT_TOKENS)) {
    html = html.replace(`<p class="md-p">${token}</p>`, () => render(relPrefix));
  }
  return html;
}

const EXPERIENCE_DIAGRAMS = {
  "{{AILY_GRAPH_RAG_DIAGRAM}}": "aily-graph-rag.html",
};

/** Blog figures: static HTML in scripts/diagrams/blog/, placed with a token on its own line. */
export const BLOG_FIGURES = {
  "{{FIG_OPENING}}": "blog/opening.html",
  "{{FIG_HARNESS}}": "blog/harness.html",
  "{{FIG_RESEND}}": "blog/resend.html",
  "{{FIG_CANVAS}}": "blog/canvas-case.html",
  "{{FIG_PREVALENCE}}": "blog/prevalence.html",
  "{{FIG_CORVUS}}": "blog/corvus.html",
  "{{FIG_APPROACHES}}": "blog/approaches.html",
  "{{FIG_REQUEST_COPY}}": "blog/request-copy.html",
  "{{FIG_TREE}}": "blog/tree.html",
  "{{FIG_UNITS}}": "blog/units.html",
  "{{FIG_TRACES}}": "blog/traces.html",
  "{{FIG_REPLAY}}": "blog/replay.html",
  "{{FIG_BUDGET}}": "blog/budget.html",
  "{{FIG_CACHE}}": "blog/cache.html",
  "{{FIG_PILOT}}": "blog/pilot.html",
  "{{FIG_SESSION}}": "blog/session.html",
  "{{FIG_VIDEO}}": "blog/video.html",
};

export function loadDiagram(filename) {
  const path = join(__dirname, "diagrams", filename);
  if (!existsSync(path)) {
    throw new Error(`Missing diagram: ${path}`);
  }
  return readFileSync(path, "utf8");
}

/** Render markdown, swapping each diagram token for its HTML file. */
function renderBodyWithDiagrams(body, diagrams) {
  const tokens = Object.keys(diagrams).filter((token) => body.includes(token));
  if (!tokens.length) return renderMarkdownBody(body);
  const tokenRe = new RegExp(`(${tokens.map((t) => t.replace(/[{}]/g, "\\$&")).join("|")})`);
  return body
    .split(tokenRe)
    .map((part) => (diagrams[part] ? loadDiagram(diagrams[part]) : renderMarkdownBody(part)))
    .join("");
}

function renderExperienceBody(body) {
  return renderBodyWithDiagrams(body, EXPERIENCE_DIAGRAMS);
}

function experienceArticleClass(slug) {
  if (slug === "cursor") return " md-doc--cursor";
  if (slug === "encore" || slug === "habitdex" || slug === "audio-silence-remover" || slug === "musatro") {
    return ` md-doc--${slug}`;
  }
  if (slug === "aily") return " md-doc--aily";
  return "";
}

function imageType(sitePath) {
  if (/\.jpe?g$/i.test(sitePath)) return "image/jpeg";
  if (/\.webp$/i.test(sitePath)) return "image/webp";
  return "image/png";
}

function absOgImage(ogImage) {
  return ogImage.startsWith("http") ? ogImage : `${SITE}${ogImage.startsWith("/") ? "" : "/"}${ogImage}`;
}

/** Width and height of a PNG or JPEG, for Open Graph and ImageObject. */
function rasterSize(sitePath) {
  const full = join(root, String(sitePath).replace(/^\//, ""));
  if (!existsSync(full)) return null;
  const buf = readFileSync(full);
  if (buf.length >= 24 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 8 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
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
  extraScripts = "",
  extraHead = "",
  footerExtra = "",
  robots = "index, follow",
  ogType = "website",
}) {
  let html = loadTemplate();
  html = html.replaceAll("{{OG_TYPE}}", escapeAttr(ogType));
  html = html.replaceAll("{{CSS_VERSION}}", CSS_VERSION);
  html = html.replaceAll("{{TITLE}}", escapeHtml(title));
  html = html.replaceAll("{{DESCRIPTION}}", escapeHtml(description));
  html = html.replaceAll("{{ROBOTS}}", escapeAttr(robots));
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
  html = html.replaceAll("{{EXTRA_SCRIPTS}}", extraScripts);
  html = html.replaceAll("{{EXTRA_HEAD}}", extraHead);
  html = html.replaceAll("{{FOOTER_EXTRA}}", footerExtra);
  return html;
}

function findLocalImageByBaseName(dir, baseName) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const filename = `${baseName}${ext}`;
    if (existsSync(join(dir, filename))) return filename;
  }
  return null;
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
              : `${ev.title}, photo ${idx}`;
          ev._imageFiles.push({ fn, alt: altRaw });
        }
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      const baseName = String(im.name || "").trim();
      if (!baseName) continue;
      let fn = findLocalImageByBaseName(assetDir, baseName);
      if (!fn && im.url) {
        fn = await downloadImageTo(im.url, assetDir, baseName);
      }
      if (fn) {
        const idx = ev._imageFiles.length + 1;
        const altRaw =
          im.alt != null && String(im.alt).trim() !== ""
            ? String(im.alt)
            : `${ev.title}, photo ${idx}`;
        ev._imageFiles.push({ fn, alt: altRaw });
      } else {
        console.warn(`cursor.json: no image for "${baseName}" in event "${ev.id}"`);
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }
}

function renderCursorEventList(events, imgRelBase, { emptyMessage, ariaLabel } = {}) {
  if (!events.length) {
    return `<p class="ev-list-empty md-p">${escapeHtml(emptyMessage || "No events listed yet.")}</p>`;
  }
  let html =
    `<section class="ev-wrap" aria-label="${escapeAttr(ariaLabel || "Events")}">\n` +
    '<ul class="ev-list">\n';
  for (const ev of events) {
    const itemClass = ev.kind === "milestone" ? "ev-list-item ev-list-item--milestone" : "ev-list-item";
    html += `<li class="${itemClass}" id="${escapeAttr(ev.id)}">\n`;
    html += `<span class="ev-list-date">${escapeHtml(ev.date)}</span>\n`;
    html += '<div class="ev-list-main">\n';
    if (ev.url) {
      html += `<a class="ev-list-title md-link" href="${escapeAttr(ev.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(ev.title)}</a>\n`;
    } else {
      html += `<span class="ev-list-title">${escapeHtml(ev.title)}</span>\n`;
    }
    if (ev.body_md && String(ev.body_md).trim()) {
      html += `<div class="ev-list-copy">${unwrapFigures(marked.parse(ev.body_md))}</div>\n`;
    }
    const partnerHtml = renderSponsorPartners(ev);
    if (partnerHtml) {
      html += `<span class="ev-list-meta">with ${partnerHtml}</span>\n`;
    }
    const files = ev._imageFiles || [];
    if (files.length) {
      html += '<div class="ev-list-photos">\n';
      for (const shot of files) {
        const href = `${imgRelBase}${shot.fn}`;
        html += `<a class="ev-shot" href="${escapeAttr(href)}">\n`;
        html += `<img src="${escapeAttr(href)}" alt="${escapeAttr(shot.alt)}" loading="lazy" decoding="async" width="640" height="400" />\n`;
        html += "</a>\n";
      }
      html += "</div>\n";
    }
    html += "</div>\n</li>\n";
  }
  html += "</ul></section>\n";
  return html;
}

function renderSponsorPartners(ev) {
  if (Array.isArray(ev.partners) && ev.partners.length) {
    return ev.partners
      .map((p) => {
        const name = escapeHtml(String(p.name || "").trim());
        if (!name) return "";
        if (p.url) {
          return `<a class="md-link" href="${escapeAttr(p.url)}" rel="noopener noreferrer" target="_blank">${name}</a>`;
        }
        return name;
      })
      .filter(Boolean)
      .join(" and ");
  }
  if (ev.partner) return escapeHtml(ev.partner);
  return "";
}

function renderCursorTabs(organizedHtml, sponsoredHtml, attendedHtml, orgCount, sponCount, attCount) {
  return (
    '<section class="cursor-tabs">\n' +
    '<div class="cursor-tabs__list" role="tablist" aria-label="Event categories">\n' +
    `<button type="button" class="cursor-tabs__tab" role="tab" id="cursor-tab-organized" aria-controls="cursor-panel-organized" aria-selected="true" data-tab="organized">Organized <span class="cursor-tabs__count">(${orgCount})</span></button>\n` +
    `<button type="button" class="cursor-tabs__tab" role="tab" id="cursor-tab-sponsored" aria-controls="cursor-panel-sponsored" aria-selected="false" tabindex="-1" data-tab="sponsored">Sponsored <span class="cursor-tabs__count">(${sponCount})</span></button>\n` +
    `<button type="button" class="cursor-tabs__tab" role="tab" id="cursor-tab-attended" aria-controls="cursor-panel-attended" aria-selected="false" tabindex="-1" data-tab="attended">Attended <span class="cursor-tabs__count">(${attCount})</span></button>\n` +
    "</div>\n" +
    '<div class="cursor-tabs__panel" role="tabpanel" id="cursor-panel-organized" aria-labelledby="cursor-tab-organized" tabindex="0">\n' +
    organizedHtml +
    "</div>\n" +
    '<div class="cursor-tabs__panel" role="tabpanel" id="cursor-panel-sponsored" aria-labelledby="cursor-tab-sponsored" tabindex="0" hidden>\n' +
    sponsoredHtml +
    "</div>\n" +
    '<div class="cursor-tabs__panel" role="tabpanel" id="cursor-panel-attended" aria-labelledby="cursor-tab-attended" tabindex="0" hidden>\n' +
    attendedHtml +
    "</div>\n" +
    "</section>\n"
  );
}

const CURSOR_TABS_SCRIPT = `<script>
(function () {
  var root = document.querySelector(".cursor-tabs");
  if (!root) return;
  var tabs = root.querySelectorAll('[role="tab"]');
  var panels = root.querySelectorAll('[role="tabpanel"]');
  var tabIds = { organized: 0, sponsored: 1, attended: 2 };

  function selectTab(name) {
    var idx = tabIds[name];
    if (idx === undefined) idx = 0;
    tabs.forEach(function (tab, i) {
      var selected = i === idx;
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(function (panel, i) {
      if (i === idx) panel.removeAttribute("hidden");
      else panel.hidden = true;
    });
    var hash = idx === 0 ? "organized" : idx === 1 ? "sponsored" : "attended";
    if (history.replaceState) history.replaceState(null, "", "#" + hash);
    else location.hash = hash;
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      selectTab(tab.getAttribute("data-tab"));
    });
    tab.addEventListener("keydown", function (e) {
      var idx = Array.prototype.indexOf.call(tabs, tab);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        var next = e.key === "ArrowRight" ? idx + 1 : idx - 1;
        if (next < 0) next = tabs.length - 1;
        if (next >= tabs.length) next = 0;
        tabs[next].focus();
        selectTab(tabs[next].getAttribute("data-tab"));
      }
    });
  });

  var hash = (location.hash || "").replace(/^#/, "");
  if (hash === "sponsored") selectTab("sponsored");
  else if (hash === "attended") selectTab("attended");
  else selectTab("organized");

  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").replace(/^#/, "");
    if (h === "sponsored" || h === "organized" || h === "attended") selectTab(h);
  });
})();
</script>`;

function warnDuplicateCursorImageUrls(data) {
  const seen = new Map();
  const allEvents = [
    ...(data.organized_events || data.events || []),
    ...(data.sponsored_events || []),
    ...(data.attended_events || []),
  ];
  for (const ev of allEvents) {
    for (const im of ev.images || []) {
      const u = im.url;
      if (!u) continue;
      if (seen.has(u)) {
        console.warn(
          `cursor.json: same image URL used in "${seen.get(u)}" and "${ev.id}". Photos will duplicate across events.`
        );
      } else {
        seen.set(u, ev.id);
      }
    }
  }
}

async function buildCursorExperiencePage(data) {
  const assetDir = join(root, "assets", "experience", "cursor");
  const organized = data.organized_events ?? data.events ?? [];
  const sponsored = data.sponsored_events ?? [];
  const attended = data.attended_events ?? [];
  warnDuplicateCursorImageUrls({ organized_events: organized, sponsored_events: sponsored, attended_events: attended });
  await hydrateCursorImages(organized, assetDir);
  await hydrateCursorImages(sponsored, assetDir);
  await hydrateCursorImages(attended, assetDir);
  const imgRel = "../../assets/experience/cursor/";
  const introHtml = renderMarkdownBody(data.intro_md);
  const organizedHtml = renderCursorEventList(organized, imgRel, {
    emptyMessage: "No organized events listed yet.",
    ariaLabel: "Organized events",
  });
  const sponsoredHtml = renderCursorEventList(sponsored, imgRel, {
    emptyMessage: "No sponsored events listed yet.",
    ariaLabel: "Sponsored events",
  });
  const attendedHtml = renderCursorEventList(attended, imgRel, {
    emptyMessage: "No attended events listed yet.",
    ariaLabel: "Attended events",
  });
  const eventCount = (list) => list.filter((ev) => ev.kind !== "milestone").length;
  const tabsHtml = renderCursorTabs(
    organizedHtml,
    sponsoredHtml,
    attendedHtml,
    eventCount(organized),
    eventCount(sponsored),
    eventCount(attended),
  );
  const bodyHtml = `${introHtml}\n${tabsHtml}`;
  const title = data.title || "SpaceXAI Ambassadors";
  const description = data.description || "";
  const ogImage = data.og_image || "/assets/companies/spacexai.png";
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
    extraScripts: CURSOR_TABS_SCRIPT,
  });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
}

function buildJsonLd(description) {
  const personId = `${SITE}/#person`;
  const websiteId = `${SITE}/#website`;
  const person = {
    ...personNode(),
    description,
    homeLocation: {
      "@type": "Place",
      name: "Madrid, Spain",
    },
    knowsLanguage: ["en", "es"],
    knowsAbout: [
      "enterprise AI consulting",
      "AI solutions architecture",
      "AI agents",
      "internal tools",
      "systems integration",
      "model deployment",
      "retrieval-augmented generation",
      "LLM compression",
      "MCP servers",
      "coding agents",
      "iOS development",
      "macOS development",
      "Madrid",
      "Spain",
    ],
    alumniOf: [
      {
        "@type": "Organization",
        name: "Multiverse Computing",
        url: "https://multiversecomputing.com/",
      },
      {
        "@type": "Organization",
        name: "AILY LABS",
        url: "https://www.ailylabs.com/",
      },
      {
        "@type": "CollegeOrUniversity",
        name: "IE School of Science and Technology",
      },
      {
        "@type": "CollegeOrUniversity",
        name: "Universidad de Burgos",
      },
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
  const graph = [person, website];
  const published = loadBlogPosts().filter((post) => !post.draft);
  if (published.length) graph.push(blogListingNode(published[0].updated));
  return toSafeJsonLdString({
    "@context": "https://schema.org",
    "@graph": graph,
  });
}

function personNode() {
  return {
    "@type": "Person",
    "@id": `${SITE}/#person`,
    name: "Felipe Basurto",
    url: SITE,
    jobTitle: "AI solutions architect",
    email: "hello@felipebasurto.com",
    image: `${SITE}/assets/profile.png`,
    sameAs: [
      "https://github.com/felipebasurto",
      "https://www.linkedin.com/in/felipe-basurto-barrio/",
      "https://x.com/fildotai",
    ],
  };
}

function markdownToPlainText(md) {
  return String(md ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function projectSchemaNode(item, group) {
  const github = [item.href, ...(item.links ?? []).map((l) => l.href)].find((h) => /github\.com\//.test(h ?? ""));
  const publicUrl = item.href && isExternalHref(item.href) ? item.href : undefined;
  const description = item.summary_md ? `${item.tagline}. ${markdownToPlainText(item.summary_md)}` : item.tagline;
  const base = {
    name: item.name,
    description,
    ...(item.year ? { dateCreated: item.year } : {}),
    ...(item.stack ? { keywords: item.stack.join(", ") } : {}),
  };
  if (group.name === "music") {
    return { "@type": "MusicGroup", ...base, url: publicUrl, genre: "Spanish pop-rock", member: { "@id": `${SITE}/#person` } };
  }
  const creator = { creator: { "@id": `${SITE}/#person` } };
  if (github) {
    return { "@type": "SoftwareSourceCode", ...base, codeRepository: github, ...(publicUrl ? { url: publicUrl } : {}), ...creator };
  }
  return { "@type": "SoftwareApplication", ...base, ...(publicUrl ? { url: publicUrl } : {}), ...creator };
}

function buildProjectsJsonLd({ name, url, description }) {
  const items = loadProjects().groups.flatMap((group) => group.items.map((item) => projectSchemaNode(item, group)));
  return toSafeJsonLdString({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    description,
    isPartOf: { "@type": "WebSite", name: "Felipe Basurto", url: SITE },
    author: personNode(),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })),
    },
  });
}

const FOLDER_TITLES = {
  apps: "Apps",
  tools: "Tools",
  experiments: "Experiments and demos",
  music: "Music",
  archive: "Earlier prototypes",
  university: "University work",
};

/** Rewrite the generated block in llms.txt so agents see the same project facts as /projects/. */
function writeLlmsProjects() {
  const path = join(root, "llms.txt");
  const begin = "<!-- BEGIN PROJECTS -->";
  const end = "<!-- END PROJECTS -->";
  const text = readFileSync(path, "utf8");
  const start = text.indexOf(begin);
  const stop = text.indexOf(end);
  if (start === -1 || stop < start) {
    console.warn("llms.txt: project markers missing; skipped");
    return;
  }
  const abs = (href) => (isExternalHref(href) ? href : `${SITE}/${href}`);
  const sections = loadProjects().groups.map((group) => {
    const lines = group.items.map((item) => {
      const meta = [item.year, item.status].filter(Boolean).join(", ");
      const summary = item.summary_md ? ` ${markdownToPlainText(item.summary_md)}` : "";
      const urls = [item.href, ...(item.links ?? []).map((l) => l.href)].filter(Boolean).map(abs);
      const links = [...new Set(urls)].join(" ");
      return `- ${item.name}${meta ? ` (${meta})` : ""}: ${item.tagline}.${summary}${links ? ` ${links}` : ""}`;
    });
    return `### ${FOLDER_TITLES[group.name] ?? group.name}\n\n${lines.join("\n")}`;
  });
  const next = `${text.slice(0, start + begin.length)}\n${sections.join("\n\n")}\n${text.slice(stop)}`;
  if (next !== text) writeFileSync(path, next, "utf8");
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

function buildServiceJsonLd({ name, url, description, serviceType, areaServed }) {
  return toSafeJsonLdString({
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    serviceType,
    description,
    url,
    provider: personNode(),
    areaServed,
    inLanguage: "en",
  });
}

function buildArticleJsonLd({ name, url, description, image, wordCount }) {
  return toSafeJsonLdString({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: name,
        description,
        url,
        ...(image ? { image: imageObject(image) } : {}),
        ...(wordCount ? { wordCount } : {}),
        inLanguage: "en",
        author: { "@id": `${SITE}/#person` },
        publisher: { "@id": `${SITE}/#person` },
        isPartOf: { "@id": `${SITE}/#website` },
        mainEntityOfPage: { "@id": url },
      },
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name,
        description,
        inLanguage: "en",
        isPartOf: { "@id": `${SITE}/#website` },
        mainEntity: { "@id": `${url}#article` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      breadcrumbList(
        [
          { name: "Home", item: `${SITE}/` },
          { name, item: url },
        ],
        `${url}#breadcrumb`,
      ),
      personNode(),
    ],
  });
}

function jsonLdForLandingPage(page, fields) {
  switch (page.schemaKind) {
    case "service":
      return buildServiceJsonLd({
        ...fields,
        serviceType: page.serviceType,
        areaServed: page.areaServed,
      });
    case "article":
      return buildArticleJsonLd(fields);
    case "webpage":
      return buildWebPageJsonLd(fields);
    default: {
      const unexpected = page.schemaKind;
      throw new Error(`Unknown schemaKind: ${unexpected}`);
    }
  }
}

function buildLandingPages() {
  for (const page of LANDING_PAGES) {
    const mdPath = join(root, page.source);
    if (!existsSync(mdPath)) {
      throw new Error(`Missing landing page source: ${page.source}`);
    }
    const raw = readFileSync(mdPath, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const title = meta.title || page.slug;
    const description = meta.description || "";
    const ogImage = meta.og_image || DEFAULT_OG_IMAGE;
    const canonicalUrl = `${SITE}/${page.slug}/`;
    const outDir = join(root, page.slug);
    mkdirSync(outDir, { recursive: true });
    const html = fillTemplate({
      title,
      description,
      ogImageAbs: absOgImage(ogImage),
      canonicalUrl,
      ogUrl: canonicalUrl,
      relPrefix: "../",
      headerHint: `~/${page.source.replace(/^content\//, "")}`,
      bodyHtml: renderMarkdownBody(body),
      jsonLd: jsonLdForLandingPage(page, {
        name: title,
        url: canonicalUrl,
        description,
        image: ogImage,
        wordCount: markdownToPlainText(body).split(" ").filter(Boolean).length,
      }),
      extraHead:
        page.schemaKind === "article" ? headTags([...siteShareMeta(), ...imageMetaTags(ogImage, title)]) : "",
    });
    writeFileSync(join(outDir, "index.html"), html, "utf8");
  }
}

function buildIndex() {
  const rawMd = readFileSync(join(root, "content", "cv.md"), "utf8");
  const { meta, body } = parseFrontmatter(rawMd);
  const title = meta.title || "Felipe Basurto";
  const description =
    meta.description ||
    "AI solutions architect in Madrid.";
  const ogImage = meta.og_image || DEFAULT_OG_IMAGE;
  const ogImageAbs = absOgImage(ogImage);
  const bodyHtml = renderPageBody(body, "./");
  const html = fillTemplate({
    title,
    description,
    ogImageAbs,
    canonicalUrl: `${SITE}/`,
    ogUrl: `${SITE}/`,
    relPrefix: "./",
    headerHint: "~/felipe.md",
    bodyHtml,
    jsonLd: buildJsonLd(description),
    docClass: "",
    articleClass: "",
  });
  writeFileSync(join(root, "index.html"), html, "utf8");
}

function build404Page() {
  const title = "404 · Felipe Basurto";
  const description = "No page at this path.";
  const canonicalUrl = `${SITE}/404.html`;
  const bodyHtml = renderMarkdownBody(`# 404

No page at this path.

[← Home](/)
`);
  const html = fillTemplate({
    title,
    description,
    ogImageAbs: absOgImage(DEFAULT_OG_IMAGE),
    canonicalUrl,
    ogUrl: canonicalUrl,
    relPrefix: "/",
    headerHint: "~/404.md",
    bodyHtml,
    jsonLd: buildWebPageJsonLd({ name: title, url: canonicalUrl, description }),
    robots: "noindex",
  });
  writeFileSync(join(root, "404.html"), html, "utf8");
}

function buildProjectsPage() {
  const mdPath = join(root, "content", "projects.md");
  if (!existsSync(mdPath)) return;
  const raw = readFileSync(mdPath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const title = meta.title || "Projects · Felipe Basurto";
  const description = meta.description || "Shipped apps and GitHub projects.";
  const ogImage = meta.og_image || DEFAULT_OG_IMAGE;
  const ogImageAbs = absOgImage(ogImage);
  const canonicalUrl = `${SITE}/projects/`;
  const bodyHtml = renderPageBody(body, "../");
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
    jsonLd: buildProjectsJsonLd({ name: title, url: canonicalUrl, description }),
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
  const title = meta.title || "Triple Check · Felipe Basurto";
  const description =
    meta.description || "Triple Check is a Spanish pop-rock band from Burgos.";
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
    const ogImage = meta.og_image || DEFAULT_OG_IMAGE;
    const ogImageAbs = absOgImage(ogImage);
    const path = `/experience/${slug}/`;
    const canonicalUrl = `${SITE}${path}`;
    const bodyHtml = renderExperienceBody(body);
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
      docClass: slug === "encore" || slug === "habitdex" || slug === "aily" || slug === "audio-silence-remover" ? " doc--wide" : "",
      articleClass: experienceArticleClass(slug),
    });
    writeFileSync(join(outDir, "index.html"), html, "utf8");
  }
}

const BLOG_DIR = join(root, "content", "blog");
const BLOG_TITLE = "Blog · Felipe Basurto";
const BLOG_DESCRIPTION = "Notes on building with AI, shipping software, and things I find worth writing down.";
const WORDS_PER_MINUTE = 220;

function isoDate(value, file, field) {
  const v = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw new Error(`content/blog/${file}: "${field}" must be YYYY-MM-DD, got "${v}"`);
  }
  return v;
}

/** Published posts, newest first. Drafts are included only with BLOG_DRAFTS=1. */
function loadBlogPosts() {
  if (!existsSync(BLOG_DIR)) return [];
  const includeDrafts = process.env.BLOG_DRAFTS === "1";
  const posts = [];
  for (const file of readdirSync(BLOG_DIR)) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(/\.md$/i, "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`content/blog/${file}: file name must be a lowercase-hyphenated slug`);
    }
    const { meta, body } = parseFrontmatter(readFileSync(join(BLOG_DIR, file), "utf8"));
    const draft = String(meta.draft ?? "").trim() === "true";
    if (draft && !includeDrafts) continue;
    for (const field of ["title", "description", "date", "cover", "cover_alt"]) {
      if (!String(meta[field] ?? "").trim()) {
        throw new Error(`content/blog/${file}: missing "${field}" in frontmatter`);
      }
    }
    const assetPath = (field) => {
      const path = `/${String(meta[field]).trim().replace(/^\/+/, "")}`;
      if (!existsSync(join(root, path))) {
        throw new Error(`content/blog/${file}: ${field} not found at ${path}`);
      }
      return path;
    };
    const cover = assetPath("cover");
    // Link previews (Open Graph, X, RSS readers) do not render SVG.
    const ogImage = meta.og_image ? assetPath("og_image") : cover;
    if (/\.svg$/i.test(ogImage)) {
      throw new Error(`content/blog/${file}: an SVG cover needs a raster "og_image" (PNG or JPG) for link previews`);
    }
    const date = isoDate(meta.date, file, "date");
    const updated = meta.updated ? isoDate(meta.updated, file, "updated") : date;
    // Collapsed <details> blocks are optional deep dives, so reading time counts the main path only.
    const mainPath = body.replace(/<details>[\s\S]*?<\/details>/g, "");
    const words = markdownToPlainText(mainPath).split(" ").filter(Boolean).length;
    posts.push({
      slug,
      title: meta.title,
      description: meta.description,
      summary: String(meta.summary ?? "").trim(),
      date,
      updated,
      cover,
      coverAlt: meta.cover_alt,
      ogImage,
      tags: String(meta.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      minutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
      words,
      draft,
      body,
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

function blogPostUrl(post) {
  return `${SITE}/blog/${post.slug}/`;
}

function blogMarkdownUrl(slug = "index") {
  return `${SITE}/blog/${slug}.md`;
}

function blogListingNode(dateModified) {
  return {
    "@type": "Blog",
    "@id": `${SITE}/blog/#blog`,
    name: BLOG_TITLE,
    url: `${SITE}/blog/`,
    description: BLOG_DESCRIPTION,
    inLanguage: "en",
    ...(dateModified ? { dateModified } : {}),
    author: { "@id": `${SITE}/#person` },
    publisher: { "@id": `${SITE}/#person` },
    isPartOf: { "@id": `${SITE}/#website` },
  };
}

function breadcrumbList(items, id) {
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

function imageObject(sitePath, caption) {
  const size = rasterSize(sitePath);
  return {
    "@type": "ImageObject",
    url: absOgImage(sitePath),
    ...(caption ? { caption } : {}),
    ...(size ?? {}),
  };
}

function siteShareMeta() {
  return [
    `<meta property="og:site_name" content="Felipe Basurto" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:creator" content="@fildotai" />`,
  ];
}

function imageMetaTags(sitePath, alt) {
  const size = rasterSize(sitePath);
  return [
    `<meta property="og:image:alt" content="${escapeAttr(alt)}" />`,
    ...(size
      ? [
          `<meta property="og:image:width" content="${size.width}" />`,
          `<meta property="og:image:height" content="${size.height}" />`,
        ]
      : []),
    `<meta name="twitter:image:alt" content="${escapeAttr(alt)}" />`,
  ];
}

function headTags(lines) {
  return `\n  ${lines.join("\n  ")}`;
}

/** Drop figure placeholders. The prose around them is the citable text. */
function blogProse(body) {
  return String(body).replace(/^\{\{FIG_[A-Z0-9_]+\}\}\n?/gm, "").trim();
}

function renderPostMeta(post) {
  const parts = [
    `<time datetime="${escapeAttr(post.date)}">${escapeHtml(post.date)}</time>`,
    ...(post.tags.length ? [escapeHtml(post.tags.join(", "))] : []),
    `${post.minutes} min`,
    ...(post.draft ? ["[draft]"] : []),
  ];
  return parts.join(LINK_SEP);
}

function renderBlogGrid(posts, relPrefix) {
  if (!posts.length) {
    return `<p class="md-p"><code class="md-codespan"><span class="md-muted">\`</span>No posts yet.<span class="md-muted">\`</span></code></p>\n`;
  }
  const items = posts
    .map((post, i) => {
      const load = i === 0 ? ` fetchpriority="high"` : ` loading="lazy"`;
      return `<li class="blog-grid__item"><a class="blog-card" href="${escapeAttr(`${post.slug}/`)}">
<img class="blog-card__cover" src="${escapeAttr(relPrefix + post.cover.slice(1))}" alt=""${load} decoding="async" width="1600" height="900" />
<h2 class="blog-card__title">${escapeHtml(post.title)}</h2>
<p class="blog-card__meta">${renderPostMeta(post)}</p>
</a></li>`;
    })
    .join("\n");
  return `<ul class="blog-grid">\n${items}\n</ul>\n`;
}

function buildBlogPostingJsonLd(post) {
  const url = blogPostUrl(post);
  return {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.description,
    url,
    image: imageObject(post.ogImage, post.coverAlt),
    datePublished: post.date,
    dateModified: post.updated,
    wordCount: post.words,
    timeRequired: `PT${post.minutes}M`,
    ...(post.tags.length ? { keywords: post.tags.join(", "), articleSection: post.tags[0] } : {}),
    inLanguage: "en",
    author: { "@id": `${SITE}/#person` },
    publisher: { "@id": `${SITE}/#person` },
    isPartOf: { "@id": `${SITE}/blog/#blog` },
    mainEntityOfPage: { "@id": url },
  };
}

function buildBlogIndexJsonLd(posts) {
  const url = `${SITE}/blog/`;
  const published = posts.filter((post) => !post.draft);
  const latest = published[0];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        ...blogListingNode(latest?.updated),
        blogPost: published.map(buildBlogPostingJsonLd),
      },
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: BLOG_TITLE,
        description: BLOG_DESCRIPTION,
        inLanguage: "en",
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": `${SITE}/blog/#blog` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        ...(latest ? { primaryImageOfPage: imageObject(latest.ogImage, latest.coverAlt) } : {}),
      },
      breadcrumbList(
        [
          { name: "Home", item: `${SITE}/` },
          { name: "Blog", item: url },
        ],
        `${url}#breadcrumb`,
      ),
      personNode(),
    ],
  };
}

function buildBlogPostJsonLd(post) {
  const url = blogPostUrl(post);
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildBlogPostingJsonLd(post),
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: `${post.title} · Felipe Basurto`,
        description: post.description,
        inLanguage: "en",
        isPartOf: { "@id": `${SITE}/blog/#blog` },
        primaryImageOfPage: imageObject(post.ogImage, post.coverAlt),
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mainEntity: { "@id": `${url}#article` },
      },
      breadcrumbList(
        [
          { name: "Home", item: `${SITE}/` },
          { name: "Blog", item: `${SITE}/blog/` },
          { name: post.title, item: url },
        ],
        `${url}#breadcrumb`,
      ),
      blogListingNode(),
      personNode(),
    ],
  };
}

function blogIndexHead(posts) {
  const latest = posts.find((post) => !post.draft);
  return headTags([
    ...siteShareMeta(),
    ...(latest ? imageMetaTags(latest.ogImage, latest.coverAlt) : []),
    `<link rel="alternate" type="text/markdown" href="${blogMarkdownUrl()}" title="Markdown" />`,
  ]);
}

function blogPostHead(post) {
  return headTags([
    ...siteShareMeta(),
    `<meta property="article:published_time" content="${post.date}T00:00:00Z" />`,
    `<meta property="article:modified_time" content="${post.updated}T00:00:00Z" />`,
    `<meta property="article:author" content="${SITE}/#person" />`,
    ...post.tags.map((tag) => `<meta property="article:tag" content="${escapeAttr(tag)}" />`),
    ...imageMetaTags(post.ogImage, post.coverAlt),
    `<link rel="alternate" type="text/markdown" href="${blogMarkdownUrl(post.slug)}" title="Markdown" />`,
  ]);
}

function buildBlogIndex(posts) {
  const canonicalUrl = `${SITE}/blog/`;
  const intro = renderMarkdownBody(`[← Home](../)

# Blog

${BLOG_DESCRIPTION}
`);
  const bodyHtml = `${intro}${renderBlogGrid(posts, "../")}`;
  const footerExtra = posts.length
    ? `\n      <a class="doc__footer-feed" href="feed.xml" title="${escapeAttr(`RSS feed: ${SITE}/blog/feed.xml`)}">feed.xml</a>`
    : "";
  const outDir = join(root, "blog");
  mkdirSync(outDir, { recursive: true });
  const html = fillTemplate({
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    ogImageAbs: absOgImage(posts[0]?.ogImage ?? DEFAULT_OG_IMAGE),
    canonicalUrl,
    ogUrl: canonicalUrl,
    relPrefix: "../",
    headerHint: "~/blog/",
    bodyHtml,
    jsonLd: toSafeJsonLdString(buildBlogIndexJsonLd(posts)),
    articleClass: " md-doc--blog",
    extraHead: blogIndexHead(posts),
    footerExtra,
    robots: posts.some((p) => !p.draft) ? "index, follow" : "noindex",
  });
  writeFileSync(join(outDir, "index.html"), html, "utf8");
}

const TOC_MIN_SECTIONS = 3;

/** Collapsible list of the post's `##` sections; omitted for short posts. */
function renderPostToc(articleHtml) {
  const sections = [...articleHtml.matchAll(/<h2 class="md-heading" id="([^"]+)">([\s\S]*?)<\/h2>/g)].map(([, id, inner]) => ({
    id,
    label: inner.replace(/<span class="md-hashes"[^>]*>[\s\S]*?<\/span>/, "").trim(),
  }));
  if (sections.length < TOC_MIN_SECTIONS) return "";
  const items = sections
    .map((s) => `<li class="post-toc__item"><a class="md-link" href="#${escapeAttr(s.id)}">${s.label}</a></li>`)
    .join("\n");
  return `<nav class="post-toc" aria-label="Table of contents">
<details class="post-toc__details" open>
<summary class="post-toc__summary">Table of contents</summary>
<ol class="post-toc__list">
${items}
</ol>
</details>
</nav>\n`;
}

function buildBlogPosts(posts) {
  for (const post of posts) {
    const canonicalUrl = blogPostUrl(post);
    const back = renderMarkdownBody(`[← All posts](../)\n`);
    const cover = `<figure class="md-figure md-figure--post md-figure--cover"><img class="md-img md-img--post" src="${escapeAttr(`../../${post.cover.slice(1)}`)}" alt="${escapeAttr(post.coverAlt)}" fetchpriority="high" decoding="async" width="1600" height="900" /></figure>\n`;
    const title = renderMarkdownBody(`# ${post.title}\n`);
    const footer = renderMarkdownBody(`---\n\n[← All posts](../) · [Home](../../)\n`);
    const articleHtml = renderBodyWithDiagrams(post.body, BLOG_FIGURES);
    const bodyHtml = `${back}${cover}${title}<p class="post-meta">${renderPostMeta(post)}</p>\n${renderPostToc(articleHtml)}${articleHtml}${footer}`;
    const outDir = join(root, "blog", post.slug);
    mkdirSync(outDir, { recursive: true });
    const html = fillTemplate({
      title: `${post.title} · Felipe Basurto`,
      description: post.description,
      ogImageAbs: absOgImage(post.ogImage),
      canonicalUrl,
      ogUrl: canonicalUrl,
      relPrefix: "../../",
      headerHint: `~/blog/${post.slug}.md`,
      bodyHtml,
      jsonLd: toSafeJsonLdString(buildBlogPostJsonLd(post)),
      docClass: " doc--post",
      articleClass: " md-doc--post",
      extraHead: blogPostHead(post),
      ogType: "article",
      robots: post.draft ? "noindex" : "index, follow",
    });
    writeFileSync(join(outDir, "index.html"), html, "utf8");
  }
}

function cdata(value) {
  return `<![CDATA[${String(value).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function writeBlogFeed(allPosts) {
  const posts = allPosts.filter((p) => !p.draft);
  const rfc822 = (d) => new Date(`${d}T00:00:00Z`).toUTCString();
  const items = posts.map((post) => {
    const url = blogPostUrl(post);
    const html = marked.parse(blogProse(post.body));
    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${rfc822(post.date)}</pubDate>`,
      `      <author>hello@felipebasurto.com (Felipe Basurto)</author>`,
      `      <dc:creator>Felipe Basurto</dc:creator>`,
      `      <description>${escapeXml(post.description)}</description>`,
      `      <content:encoded>${cdata(html)}</content:encoded>`,
      ...post.tags.map((t) => `      <category>${escapeXml(t)}</category>`),
      `      <media:content url="${escapeXml(absOgImage(post.ogImage))}" medium="image" type="${imageType(post.ogImage)}" />`,
      "    </item>",
    ].join("\n");
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">',
    "  <channel>",
    `    <title>${escapeXml(BLOG_TITLE)}</title>`,
    `    <link>${SITE}/blog/</link>`,
    `    <atom:link href="${SITE}/blog/feed.xml" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeXml(BLOG_DESCRIPTION)}</description>`,
    "    <language>en</language>",
    "    <dc:creator>Felipe Basurto</dc:creator>",
    ...(posts.length ? [`    <lastBuildDate>${rfc822(posts[0].updated)}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
  mkdirSync(join(root, "blog"), { recursive: true });
  writeFileSync(join(root, "blog", "feed.xml"), xml, "utf8");
}

/** Plain-text copies for answer engines. The HTML page stays the canonical URL. */
function writeBlogMarkdown(posts) {
  const published = posts.filter((post) => !post.draft);
  const index = [
    "# Blog",
    "",
    `Canonical: ${SITE}/blog/`,
    `Author: Felipe Basurto (${SITE}/)`,
    `RSS: ${SITE}/blog/feed.xml`,
    "",
    BLOG_DESCRIPTION,
    "",
    ...published.map(
      (post) =>
        `- ${post.date}: ${post.title}. ${post.description} ${blogPostUrl(post)} · Markdown: ${blogMarkdownUrl(post.slug)}`,
    ),
    "",
  ].join("\n");
  mkdirSync(join(root, "blog"), { recursive: true });
  writeFileSync(join(root, "blog", "index.md"), index, "utf8");
  for (const post of published) {
    const updated = post.updated !== post.date ? `\nUpdated: ${post.updated}` : "";
    const tags = post.tags.length ? `\nTags: ${post.tags.join(", ")}` : "";
    const text = `# ${post.title}

Canonical: ${blogPostUrl(post)}
Author: Felipe Basurto (${SITE}/)
Published: ${post.date}${updated}${tags}

${post.description}

---

${blogProse(post.body)}
`;
    writeFileSync(join(root, "blog", `${post.slug}.md`), text, "utf8");
  }
}

/** Rewrite the generated blog block in llms.txt; empty until the first post ships. */
function writeLlmsBlog(posts) {
  const path = join(root, "llms.txt");
  const begin = "<!-- BEGIN BLOG -->";
  const end = "<!-- END BLOG -->";
  const text = readFileSync(path, "utf8");
  const start = text.indexOf(begin);
  const stop = text.indexOf(end);
  if (start === -1 || stop < start) {
    console.warn("llms.txt: blog markers missing; skipped");
    return;
  }
  const published = posts.filter((p) => !p.draft);
  const block = published.length
    ? `\n## Blog\n\nIndex: ${SITE}/blog/ · Markdown: ${blogMarkdownUrl()} · RSS: ${SITE}/blog/feed.xml\n\n${published
        .map(
          (p) =>
            `- ${p.date}: ${p.title}. ${p.description} ${blogPostUrl(p)} · Markdown: ${blogMarkdownUrl(p.slug)}`,
        )
        .join("\n")}\n`
    : "\n";
  const next = `${text.slice(0, start + begin.length)}${block}${text.slice(stop)}`;
  if (next !== text) writeFileSync(path, next, "utf8");
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

function writeSitemap(posts) {
  const today = new Date().toISOString().slice(0, 10);
  const slugs = getExperienceSlugsForSitemap();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];
  const pushUrl = (loc, priority, lastmod = today, image) => {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(loc)}</loc>`);
    lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
    lines.push("    <changefreq>monthly</changefreq>");
    lines.push(`    <priority>${priority}</priority>`);
    if (image) {
      lines.push("    <image:image>");
      lines.push(`      <image:loc>${escapeXml(image.loc)}</image:loc>`);
      lines.push(`      <image:title>${escapeXml(image.title)}</image:title>`);
      if (image.caption) lines.push(`      <image:caption>${escapeXml(image.caption)}</image:caption>`);
      lines.push("    </image:image>");
    }
    lines.push("  </url>");
  };
  pushUrl(`${SITE}/`, "1.0");
  for (const page of LANDING_PAGES) {
    if (existsSync(join(root, page.source))) {
      pushUrl(`${SITE}/${page.slug}/`, "0.8");
    }
  }
  if (existsSync(join(root, "content", "projects.md"))) {
    pushUrl(`${SITE}/projects/`, "0.75");
  }
  if (existsSync(join(root, "content", "triplecheck.md"))) {
    pushUrl(`${SITE}/triplecheck/`, "0.7");
  }
  for (const slug of slugs) {
    pushUrl(`${SITE}/experience/${slug}/`, "0.7");
  }
  const published = posts.filter((p) => !p.draft);
  if (published.length) {
    const latest = published[0];
    pushUrl(`${SITE}/blog/`, "0.7", latest.updated, {
      loc: absOgImage(latest.ogImage),
      title: BLOG_TITLE,
      caption: latest.coverAlt,
    });
    for (const post of published) {
      pushUrl(blogPostUrl(post), "0.6", post.updated, {
        loc: absOgImage(post.ogImage),
        title: post.title,
        caption: post.coverAlt,
      });
    }
  }
  lines.push("</urlset>");
  lines.push("");
  writeFileSync(join(root, "sitemap.xml"), lines.join("\n"), "utf8");
}

async function main() {
  buildIndex();
  buildProjectsPage();
  buildTriplecheckPage();
  buildLandingPages();
  await buildExperiencePages();
  const posts = loadBlogPosts();
  rmSync(join(root, "blog"), { recursive: true, force: true });
  buildBlogIndex(posts);
  buildBlogPosts(posts);
  writeBlogFeed(posts);
  writeBlogMarkdown(posts);
  build404Page();
  writeSitemap(posts);
  writeLlmsProjects();
  writeLlmsBlog(posts);
  console.log(
    `Build OK: index.html + landing pages + projects/* + triplecheck/* + experience/* + blog/* (${posts.length} ${posts.length === 1 ? "post" : "posts"}) + 404.html + sitemap.xml`,
  );
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return fileURLToPath(import.meta.url) === resolve(entry);
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
