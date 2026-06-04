/**
 * 清理抖音 penalty 重复卡并去掉 body 中的「来源/参见」行。
 * 运行: node scripts/clean-douyin-penalty-cards.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REFERENCE_BODY_RE =
  /来源\s*[：:]|参见|详见|违规处理细则参见|参考【|参考《|细则参见/;

function sanitizeCuratedCardBody(body) {
  let text = String(body || "").trim();
  if (!text) {
    return "";
  }

  text = text.replace(/<li[^>]*>[\s\S]*?<\/li>/gi, (li) => {
    const plain = li.replace(/<[^>]+>/g, "");
    if (REFERENCE_BODY_RE.test(plain)) {
      return "";
    }
    return li;
  });

  text = text.replace(REFERENCE_BODY_RE, "");
  return text.trim();
}

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relPath) {
  const raw = await readFile(path.join(repoRoot, relPath), "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function writeJson(relPath, value) {
  const full = path.join(repoRoot, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, `\uFEFF${JSON.stringify(value, null, 2)}`, "utf8");
}

const cardsDoc = await readJson("data/douyin/curated-cards.json");
const penalty = cardsDoc.penalty;
if (!penalty?.cards) {
  throw new Error("penalty.cards missing");
}

const kept = penalty.cards
  .filter((c) => c.sourceId !== "dy-rule-101706")
  .map((c) => ({
    ...c,
    body: sanitizeCuratedCardBody(c.body)
  }));

kept.forEach((card, index) => {
  card.cardId = `penalty:${index}`;
});

penalty.cards = kept;
penalty.desc =
  "发货超时、缺货/无货、物流轨迹超时/异常、欺诈发货等实施细则；每条来源对应 1 张卡片，正文摘录认定与订单扣罚标准。";
cardsDoc.updatedAt = new Date().toISOString();

for (const rel of ["data/douyin/curated-cards.json", "public/data/douyin/curated-cards.json"]) {
  await writeJson(rel, cardsDoc);
}

console.log(JSON.stringify({ ok: true, penaltyCards: kept.length }, null, 2));
