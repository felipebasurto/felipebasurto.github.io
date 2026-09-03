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
      const inner = lines
        .map((line) => {
          if (emailRe.test(line)) {
            return `<a class="md-link" href="mailto:${escapeAttr(line)}" title="mailto:${escapeAttr(line)}">${escapeHtml(line)}</a>`;
          }
          return escapeHtml(line);
        })
        .join("\n");
      return `<div class="md-codeblock${contactClass}"><div class="md-codeblock-gutter" aria-hidden="true">${escapeHtml(label)}</div><pre class="md-pre"><code class="md-code${lang ? ` language-${lang}` : ""}">${inner}</code></pre></div>\n`;
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

function unwrapFigures(html) {
  let out = html;
  const openPatterns = [
    /<p class="md-p">\s*<figure class="md-figure md-figure--appshot">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--appicon">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--macshot">/g,
    /<p class="md-p">\s*<figure class="md-figure md-figure--gameshot">/g,
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

function wrapGameShotGrids(html) {
  return html.replace(
    /(?:<figure class="md-figure md-figure--gameshot">[\s\S]*?<\/figure>(?:\s*\n*)?)+/g,
    (block) => `<div class="md-gameshot-grid">\n${block.trim()}\n</div>\n`
  );
}

function renderMarkdownBody(body) {
  return wrapGameShotGrids(wrapAppShotGrids(unwrapFigures(marked.parse(body))));
}

const EXPERIENCE_DIAGRAMS = {
  "{{AILY_GRAPH_RAG_DIAGRAM}}": "aily-graph-rag.html",
};

function loadExperienceDiagram(filename) {
  const path = join(__dirname, "diagrams", filename);
  if (!existsSync(path)) {
    console.warn(`Missing diagram: ${path}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function renderExperienceBody(body) {
  for (const [token, file] of Object.entries(EXPERIENCE_DIAGRAMS)) {
    if (!body.includes(token)) continue;
    const diagram = loadExperienceDiagram(file);
    const parts = body.split(token);
    body = parts.map((part) => renderMarkdownBody(part)).join(diagram);
    return body;
  }
  return renderMarkdownBody(body);
}

function experienceArticleClass(slug) {
  if (slug === "cursor") return " md-doc--cursor";
  if (slug === "encore" || slug === "habitdex" || slug === "audio-silence-remover" || slug === "musatro") {
    return ` md-doc--${slug}`;
  }
  if (slug === "aily") return " md-doc--aily";
  return "";
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
  extraScripts = "",
  robots = "index, follow",
}) {
  let html = loadTemplate();
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
    html += `<li class="ev-list-item" id="${escapeAttr(ev.id)}">\n`;
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

function renderCursorTabs(organizedHtml, sponsoredHtml, orgCount, sponCount) {
  return (
    '<section class="cursor-tabs">\n' +
    '<div class="cursor-tabs__list" role="tablist" aria-label="Event categories">\n' +
    `<button type="button" class="cursor-tabs__tab" role="tab" id="cursor-tab-organized" aria-controls="cursor-panel-organized" aria-selected="true" data-tab="organized">Organized <span class="cursor-tabs__count">(${orgCount})</span></button>\n` +
    `<button type="button" class="cursor-tabs__tab" role="tab" id="cursor-tab-sponsored" aria-controls="cursor-panel-sponsored" aria-selected="false" tabindex="-1" data-tab="sponsored">Sponsored <span class="cursor-tabs__count">(${sponCount})</span></button>\n` +
    "</div>\n" +
    '<div class="cursor-tabs__panel" role="tabpanel" id="cursor-panel-organized" aria-labelledby="cursor-tab-organized" tabindex="0">\n' +
    organizedHtml +
    "</div>\n" +
    '<div class="cursor-tabs__panel" role="tabpanel" id="cursor-panel-sponsored" aria-labelledby="cursor-tab-sponsored" tabindex="0" hidden>\n' +
    sponsoredHtml +
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
  var tabIds = { organized: 0, sponsored: 1 };

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
    var hash = idx === 0 ? "organized" : "sponsored";
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
  else selectTab("organized");

  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").replace(/^#/, "");
    if (h === "sponsored" || h === "organized") selectTab(h);
  });
})();
</script>`;

function warnDuplicateCursorImageUrls(data) {
  const seen = new Map();
  const allEvents = [
    ...(data.organized_events || data.events || []),
    ...(data.sponsored_events || []),
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
  warnDuplicateCursorImageUrls({ organized_events: organized, sponsored_events: sponsored });
  await hydrateCursorImages(organized, assetDir);
  await hydrateCursorImages(sponsored, assetDir);
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
  const tabsHtml = renderCursorTabs(organizedHtml, sponsoredHtml, organized.length, sponsored.length);
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
    "@type": "Person",
    "@id": personId,
    name: "Felipe Basurto",
    description,
    image: `${SITE}/assets/profile.png`,
    url: SITE,
    sameAs: [
      "https://github.com/felipebasurto",
      "https://www.linkedin.com/in/felipe-basurto-barrio/",
      "https://x.com/fildotai",
    ],
    homeLocation: {
      "@type": "Place",
      name: "Madrid, Spain",
    },
    knowsLanguage: ["en", "es"],
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
    "AI solutions architect and data scientist based in Madrid.";
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

function build404Page() {
  const title = "404 · Felipe Basurto";
  const description = "No page at this path.";
  const canonicalUrl = `${SITE}/404.html`;
  const bodyHtml = renderMarkdownBody(`# 404

No page at this path.

[← Back to CV](/)
`);
  const html = fillTemplate({
    title,
    description,
    ogImageAbs: absOgImage("/assets/profile.png"),
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
    const ogImage = meta.og_image || "/assets/profile.png";
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
  if (existsSync(join(root, "musatro", "index.html"))) {
    pushUrl(`${SITE}/musatro/`, "0.6");
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
  build404Page();
  writeSitemap();
  console.log("Build OK: index.html + projects/* + triplecheck/* + experience/* + 404.html + sitemap.xml");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
