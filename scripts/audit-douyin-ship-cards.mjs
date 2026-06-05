/**
 * 抖音 ship 卡片 highlight/num 防回归检查。
 * 运行: node scripts/audit-douyin-ship-cards.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const REFERENCE_BODY_RE =
  /来源\s*[：:]|参见|详见|违规处理细则参见|参考【|参考《|细则参见/;
const PENALTY_KEYWORD_RE = /扣罚|赔付|实付|违约金|%/;

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

export function auditDouyinShipCards(cardsDoc) {
  const issues = [];
  const ship = cardsDoc?.ship;
  const cards = ship?.cards;

  if (!Array.isArray(cards)) {
    return fail("ship.cards missing or not an array");
  }

  if (cards.length < 1) {
    issues.push("ship.cards must contain at least 1 card");
  }

  for (const card of cards) {
    const body = String(card.body || "");
    const plain = stripHtml(body);
    const cardRef = card.cardId || card.title || "unknown";

    if (!body.includes('class="highlight"')) {
      issues.push(`${cardRef}: body must include span.highlight markup`);
    }

    if (!body.includes('class="num"')) {
      issues.push(`${cardRef}: body must include span.num markup`);
    }

    if (REFERENCE_BODY_RE.test(plain)) {
      issues.push(`${cardRef}: body contains 参见/来源/详见 reference text`);
    }

    if (PENALTY_KEYWORD_RE.test(plain)) {
      issues.push(`${cardRef}: ship body must not include penalty keywords (扣罚/赔付/实付/%)`);
    }
  }

  if (issues.length) {
    return fail("douyin ship audit failed", issues);
  }

  return pass({
    shipCards: cards.length
  });
}

async function main() {
  const cardsDoc = await readJson("data/douyin/curated-cards.json");
  const result = auditDouyinShipCards(cardsDoc);

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
    console.error("[audit-douyin-ship] failed:", err);
    process.exit(1);
  });
}
