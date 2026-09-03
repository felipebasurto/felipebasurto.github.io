import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const publicCopyFiles = [
  "content/cv.md",
  "content/projects.md",
  "content/triplecheck.md",
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

const entityRules = {
  "content/experience/cursor.json": [
    /\bA Coru(?:ñ|n)a\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bHabitDex\b/iu,
    /\biOS\b/u,
    /\bmacOS\b/u,
    /\bMusatro\b/iu,
    /\bTriple Check\b/iu,
    /\bValencia\b/iu,
    /\bband\b/iu,
    /\bon the side\b/iu,
  ],
  "content/experience/encore.md": [
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bMusatro\b/iu,
    /\bRegional Lead\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/experience/habitdex.md": [
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bMusatro\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/experience/audio-silence-remover.md": [
    /\bAmbassador\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bMusatro\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/experience/musatro.md": [
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/experience/multiverse.md": [
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bMusatro\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/experience/aily.md": [
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bMusatro\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/experience/ie.md": [
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bMusatro\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/experience/ubu.md": [
    /\bAILY\b/iu,
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bMultiverse\b/iu,
    /\bMusatro\b/iu,
    /\bSpaceXAI\b/iu,
    /\bTriple Check\b/iu,
    /\bband\b/iu,
  ],
  "content/triplecheck.md": [
    /\bAILY\b/iu,
    /\bAmbassador\b/iu,
    /\bAudio Silence Remover\b/iu,
    /\bEncore\b/iu,
    /\bGrok Bot\b/iu,
    /\bHabitDex\b/iu,
    /\bMultiverse\b/iu,
    /\bMusatro\b/iu,
    /\bSpaceXAI\b/iu,
  ],
};

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

for (const [path, patterns] of Object.entries(entityRules)) {
  const text = content.get(path);
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      errors.push(`${path}: crosses its entity boundary with ${pattern}`);
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
  .replace(/!\[[^\]]*]\([^)]*\)/gu, "")
  .replace(/\[([^\]]+)]\([^)]*\)/gu, "$1")
  .trim();
const sentenceCount = homeLead.match(/[.!?](?:\s|$)/gu)?.length ?? 0;

if (title !== "Felipe Basurto · Madrid") {
  errors.push('content/cv.md: title must be "Felipe Basurto · Madrid"');
}
if (description.length > 90 || (description.match(/[.!?]/gu)?.length ?? 0) !== 1) {
  errors.push("content/cv.md: description must be one short sentence");
}
if (sentenceCount < 2 || sentenceCount > 4) {
  errors.push(`content/cv.md: home lead has ${sentenceCount} sentences, expected 2 to 4`);
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
