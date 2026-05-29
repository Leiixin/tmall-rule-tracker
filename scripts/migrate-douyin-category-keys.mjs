/**
 * 将抖音 rules.json / scraped.json 从 dy_* 标签迁移为 shelf/score/ship/penalty
 * 运行: node scripts/migrate-douyin-category-keys.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, "data", "douyin");
const publicDir = path.join(repoRoot, "public", "data", "douyin");

const CATEGORY_KEYWORDS = {
  shelf: ["效期", "临期", "保质期", "过期", "禁售", "新鲜日期", "盲盒", "商品信息", "到期"],
  score: ["体验分", "商家体验分", "商品体验", "物流体验", "服务体验", "品退", "差评", "综合评分"],
  ship: ["发货", "揽收", "物流时效", "轨迹", "售后", "退款", "消极服务", "飞鸽", "配送"],
  penalty: ["违规", "处罚", "违约金", "扣分", "虚假交易", "价格违规", "清退", "封禁", "赔付"]
};

const BUCKET_KEYS = ["shelf", "score", "ship", "penalty"];

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text) {
  return normalizeText(text)
    .split(/[。；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function pickSentence(text, keywords) {
  const sentences = splitSentences(text);
  const matched = sentences.find((sentence) => containsAny(sentence, keywords));
  return matched || "未识别到明确描述";
}

function classifyRule(rule) {
  const text = normalizeText(`${rule.title || ""} ${rule.content || ""} ${rule.snippet || ""}`);
  const tags = Object.entries(CATEGORY_KEYWORDS)
    .filter(([, keywords]) => containsAny(text, keywords))
    .map(([key]) => key);

  return {
    ...rule,
    snippet: normalizeText(rule.content || rule.snippet || "").slice(0, 220),
    tags,
    summary: {
      shelf: pickSentence(text, CATEGORY_KEYWORDS.shelf),
      score: pickSentence(text, CATEGORY_KEYWORDS.score),
      ship: pickSentence(text, CATEGORY_KEYWORDS.ship),
      penalty: pickSentence(text, CATEGORY_KEYWORDS.penalty)
    }
  };
}

function buildScrapedBuckets(rules) {
  const buckets = Object.fromEntries(BUCKET_KEYS.map((key) => [key, []]));
  buckets.general = [];

  for (const rule of rules) {
    const tags = Array.isArray(rule.tags) ? rule.tags : [];
    let matched = false;
    for (const tag of BUCKET_KEYS) {
      if (tags.includes(tag)) {
        buckets[tag].push({
          title: rule.title || "未命名规则",
          url: rule.url || "",
          source: rule.source || "抖音电商规则中心",
          category: tag,
          discoveredAt: rule.lastSeenAt || rule.publishedAt || new Date().toISOString(),
          effectiveDate: String(rule.publishedAt || "").slice(0, 10),
          summary: rule.snippet || ""
        });
        matched = true;
      }
    }
    if (!matched) {
      buckets.general.push({
        title: rule.title || "未命名规则",
        url: rule.url || "",
        source: rule.source || "抖音电商规则中心",
        category: "general",
        discoveredAt: rule.lastSeenAt || rule.publishedAt || new Date().toISOString(),
        effectiveDate: String(rule.publishedAt || "").slice(0, 10),
        summary: rule.snippet || ""
      });
    }
  }

  return buckets;
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function writeJsonBoth(name, value) {
  const json = `\uFEFF${JSON.stringify(value, null, 2)}`;
  for (const dir of [dataDir, publicDir]) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), json, "utf8");
  }
}

const rules = await readJson(path.join(dataDir, "rules.json"));
const classified = rules.map((rule) => classifyRule(rule));
await writeJsonBoth("rules.json", classified);

const scraped = await readJson(path.join(dataDir, "scraped.json"));
const newBuckets = buildScrapedBuckets(classified);
const migratedScraped = {
  lastUpdated: new Date().toISOString(),
  categorized: newBuckets
};
await writeJsonBoth("scraped.json", migratedScraped);

const tagCounts = Object.fromEntries(BUCKET_KEYS.map((k) => [k, 0]));
for (const rule of classified) {
  for (const tag of rule.tags || []) {
    if (tagCounts[tag] !== undefined) {
      tagCounts[tag] += 1;
    }
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      rules: classified.length,
      tagCounts,
      scrapedBuckets: Object.fromEntries(
        [...BUCKET_KEYS, "general"].map((k) => [
          k,
          migratedScraped.categorized[k]?.length || 0
        ])
      )
    },
    null,
    2
  )
);
