/**
 * 抖音 penalty 卡片防回归检查。
 * 运行: node scripts/audit-douyin-penalty-cards.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cardsPath = path.join(repoRoot, "data/douyin/curated-cards.json");

const REFERENCE_BODY_RE =
  /来源\s*[：:]|参见|详见|违规处理细则参见|参考【|参考《|细则参见/;
const PENALTY_KEYWORD_RE = /扣罚|赔付|实付|违约金|%/;

const EXPECTED_IMPLEMENTATION_SOURCES = [
  "dy-rule-aHwH9wK4Je2N",
  "dy-rule-aHwHGWzbmk88",
  "dy-rule-aHwHroCPheig",
  "dy-rule-aHzmeN9E9dBF",
  "dy-rule-aHwH9wK4JyWJ"
];

function normalizeTitle(title) {
  return String(title || "")
    .replace(/[：:].*$/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readJson(relPath) {
  const raw = await readFile(path.join(repoRoot, relPath), "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function fail(message, details = []) {
  return { ok: false, message, details };
}

function pass(summary) {
  return { ok: true, summary };
}

export function auditDouyinPenaltyCards(cardsDoc) {
  const issues = [];
  const penalty = cardsDoc?.penalty;
  const cards = penalty?.cards;

  if (!Array.isArray(cards)) {
    return fail("penalty.cards missing or not an array");
  }

  if (cards.length !== EXPECTED_IMPLEMENTATION_SOURCES.length) {
    issues.push(
      `expected ${EXPECTED_IMPLEMENTATION_SOURCES.length} penalty cards, got ${cards.length}`
    );
  }

  const titleKeys = new Map();
  const sourceIds = new Set();

  for (const card of cards) {
    const plain = stripHtml(card.body);
    const key = normalizeTitle(card.title);

    if (card.sourceId === "dy-rule-101706") {
      issues.push(`${card.cardId}: must not come from dy-rule-101706 (总纲只产 ship)`);
    }

    if (REFERENCE_BODY_RE.test(plain)) {
      issues.push(`${card.cardId}: body contains 参见/来源/详见 reference text`);
    }

    const hasRecognition = /认定|定义|判定|违规|情形|揽收|发运/.test(plain);
    if (!hasRecognition) {
      issues.push(`${card.cardId}: body missing recognition/definition keywords`);
    }

    if (!PENALTY_KEYWORD_RE.test(plain)) {
      issues.push(`${card.cardId}: body missing penalty keywords (扣罚/赔付/实付/%)`);
    }

    if (titleKeys.has(key)) {
      issues.push(
        `${card.cardId}: duplicate normalized title "${key}" (also ${titleKeys.get(key)})`
      );
    } else {
      titleKeys.set(key, card.cardId);
    }

    sourceIds.add(card.sourceId);
  }

  for (const expected of EXPECTED_IMPLEMENTATION_SOURCES) {
    if (!sourceIds.has(expected)) {
      issues.push(`missing penalty card for source ${expected}`);
    }
  }

  if (issues.length) {
    return fail("douyin penalty audit failed", issues);
  }

  return pass({
    penaltyCards: cards.length,
    sources: [...sourceIds]
  });
}

async function main() {
  const cardsDoc = await readJson("data/douyin/curated-cards.json");
  const result = auditDouyinPenaltyCards(cardsDoc);

  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, ...result.summary }, null, 2));
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error("[audit-douyin-penalty] failed:", err);
    process.exit(1);
  });
}
