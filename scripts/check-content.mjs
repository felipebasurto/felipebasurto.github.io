import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDING_PAGES } from "./build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

const publicCopyFiles = [
  "content/cv.md",
  "content/projects.md",
  "content/triplecheck.md",
  ...LANDING_PAGES.map((page) => page.source),
  "content/experience/aily.md",
  "content/experience/audio-silence-remover.md",
  "content/experience/cursor.json",
  "content/experience/encore.md",
  "content/experience/habitdex.md",
  "content/experience/ie.md",
  "content/experience/multiverse.md",
  "content/experience/musatro.md",
  "content/experience/ubu.md",
  "llms.txt",
  "scripts/diagrams/aily-graph-rag.html",
];

const proseRules = [
  { label: "em dash", pattern: /—/u },
  { label: "curly quotation mark", pattern: /[“”]/u },
  { label: '"not just X but Y"', pattern: /\bnot just\b[^.!?\n]{0,100}\bbut\b/iu },
  {
    label: "AI stock vocabulary",
    pattern:
      /\b(additionally|crucial|delve|enduring|enhance|fostering|garner|interplay|intricate|landscape|pivotal|showcase|tapestry|testament|underscore|vibrant|leverage)\b/iu,
  },
];

const entityPatterns = {
  aily: /\bAILY(?: LABS)?\b/iu,
  audioSilenceRemover: /\bAudio Silence Remover\b/iu,
  cursor: /\b(?:Cursor|SpaceXAI|Grok Bot|Ambassador|Regional Lead)\b/iu,
  encore: /\bEncore\b/iu,
  habitdex: /\bHabitDex\b/iu,
  ie: /\b(?:IE School of Science and Technology|FITIZENS)\b/iu,
  multiverse: /\b(?:Multiverse Computing|CompactifAI)\b/iu,
  musatro: /\bMusatro\b/iu,
  triplecheck: /\b(?:Triple Check|band)\b/iu,
  ubu: /\bUniversidad de Burgos\b/iu,
};

const pageOwners = {
  "content/experience/aily.md": ["aily"],
  "content/experience/audio-silence-remover.md": ["audioSilenceRemover"],
  "content/experience/cursor.json": ["cursor"],
  "content/experience/encore.md": ["encore", "cursor"],
  "content/experience/habitdex.md": ["habitdex"],
  "content/experience/ie.md": ["ie"],
  "content/experience/multiverse.md": ["multiverse"],
  "content/experience/musatro.md": ["musatro"],
  "content/experience/ubu.md": ["ubu"],
  "content/triplecheck.md": ["triplecheck"],
};

const pageRules = {
  "content/experience/cursor.json": [
    { label: "A Coruña", pattern: /\bA Coru(?:ñ|n)a\b/iu },
    { label: "Valencia", pattern: /\bValencia\b/iu },
    { label: "product platform", pattern: /\b(?:iOS|macOS|Mac)\b/u },
    { label: "side-work wording", pattern: /\bon the side\b/iu },
    { label: "Slack internals", pattern: /\b(?:Slack|Sunita|Ben Lang)\b/iu },
  ],
};

const homeStoryRules = [
  {
    label: "Multiverse work",
    pattern: /\b(?:CompactifAI|model compression|reference architecture|Claude skills)\b/iu,
  },
  {
    label: "AILY work",
    pattern: /\b(?:LangChain|Langfuse|Graph RAG|Neo4j|Airflow|ETL)\b/iu,
  },
  {
    label: "Encore story",
    pattern: /\b(?:SwiftUI|revenue|paying users|passport|year-end recap|TikTok|Instagram)\b/iu,
  },
  {
    label: "HabitDex story",
    pattern: /\b(?:Pokémon|CloudKit|RevenueCat|StoreKit|streaks?)\b/iu,
  },
  {
    label: "Audio Silence Remover story",
    pattern: /\b(?:decibel|threshold|waveform|silence detection)\b/iu,
  },
  {
    label: "Musatro story",
    pattern: /\b(?:roguelike|Spanish deck|antes?|bosses)\b/iu,
  },
  {
    label: "Triple Check story",
    pattern: /\b(?:Spotify streams?|EP|venues?)\b/iu,
  },
];

const errors = [];
const content = new Map(
  publicCopyFiles.map((path) => [path, readFileSync(join(root, path), "utf8")]),
);

for (const [path, text] of content) {
  for (const rule of proseRules) {
    if (rule.pattern.test(text)) {
      errors.push(`${path}: contains ${rule.label}`);
    }
  }
}

for (const [path, owners] of Object.entries(pageOwners)) {
  const text = content.get(path);
  for (const [entity, pattern] of Object.entries(entityPatterns)) {
    if (owners.includes(entity)) {
      continue;
    }
    if (pattern.test(text)) {
      errors.push(`${path}: crosses its entity boundary with ${entity}`);
    }
  }
}

for (const [path, rules] of Object.entries(pageRules)) {
  const text = content.get(path);
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      errors.push(`${path}: contains prohibited ${rule.label} detail`);
    }
  }
}

const home = content.get("content/cv.md");
const title = home.match(/^title:\s*"([^"]+)"/mu)?.[1] ?? "";
const description = home.match(/^description:\s*"([^"]+)"/mu)?.[1] ?? "";
const profileEnd = home.indexOf("\n", home.indexOf("![Profile photo]"));
const fenceStart = home.indexOf("\n```", profileEnd);
const experienceStart = home.indexOf("\n## Experience", fenceStart);
const homeLead = home
  .slice(profileEnd, fenceStart)
  .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
  .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
  .trim();
const sentenceCount = homeLead.match(/[.!?](?:\s|$)/gu)?.length ?? 0;

for (const rule of homeStoryRules) {
  if (rule.pattern.test(home)) {
    errors.push(`content/cv.md: repeats ${rule.label} instead of linking to Details`);
  }
}

if (title !== "Felipe Basurto · Madrid") {
  errors.push('content/cv.md: title must be "Felipe Basurto · Madrid"');
}
if (description.length > 90 || (description.match(/[.!?]/gu)?.length ?? 0) !== 1) {
  errors.push("content/cv.md: description must be one short sentence");
}
if (sentenceCount < 2 || sentenceCount > 4) {
  errors.push(`content/cv.md: home lead has ${sentenceCount} sentences, expected 2 to 4`);
}
if (/\b(started as|then|after|going forward)\b/iu.test(homeLead)) {
  errors.push("content/cv.md: home lead tells a chronology instead of summarizing current work");
}
if (fenceStart === -1 || experienceStart === -1 || fenceStart > experienceStart) {
  errors.push("content/cv.md: contact fence must appear before Experience");
}
if (!home.slice(fenceStart, experienceStart).includes("hello@felipebasurto.com")) {
  errors.push("content/cv.md: contact fence must keep hello@felipebasurto.com");
}

const cursor = content.get("content/experience/cursor.json");
if (!cursor.includes("../../assets/companies/spacexai.png")) {
  errors.push("content/experience/cursor.json: SpaceXAI logo path is missing");
}
if (!cursor.includes("Cursor Community Regional Lead for Europe")) {
  errors.push("content/experience/cursor.json: official Cursor role wording is missing");
}

const landingPaths = LANDING_PAGES.map((page) => page.source);
const hireBan = /\b(?:freelance(?:r)?|agency|solopreneur|available for hire)\b/iu;
for (const path of landingPaths) {
  if (hireBan.test(content.get(path))) {
    errors.push(`${path}: contains freelance, agency, solopreneur, or available for hire`);
  }
}

function landingSource(slug) {
  return LANDING_PAGES.find((page) => page.slug === slug)?.source;
}

const consultingPath = landingSource("ai-consulting");
const pharmaPath = landingSource("ai-for-pharma-operations");
if (!consultingPath || !pharmaPath) {
  errors.push("LANDING_PAGES: missing ai-consulting or ai-for-pharma-operations");
}

const consulting = consultingPath ? content.get(consultingPath) : "";
if (consultingPath && !/enterprise AI consulting/iu.test(consulting)) {
  errors.push(`${consultingPath}: missing enterprise AI consulting service language`);
}
if (consultingPath && !consulting.includes("hello@felipebasurto.com")) {
  errors.push(`${consultingPath}: missing hello@felipebasurto.com`);
}

const pharma = pharmaPath ? content.get(pharmaPath) : "";
if (
  pharmaPath &&
  (!/do not work on manufacturing control/iu.test(pharma) ||
    !/regulated decisions/iu.test(pharma))
) {
  errors.push(
    `${pharmaPath}: must disclaim manufacturing control and regulated decisions`,
  );
}

const multiverse = content.get("content/experience/multiverse.md");
if (!multiverse.includes("Nov 2025") || !multiverse.includes("July 2026")) {
  errors.push("content/experience/multiverse.md: exact role dates are missing");
}
if (/\bpresent\b/iu.test(multiverse)) {
  errors.push('content/experience/multiverse.md: past role must not say "present"');
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Content check OK: ${publicCopyFiles.length} public sources`);
