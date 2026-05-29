/**
 * 旧版单条种子脚本；完整四类数据请使用: node scripts/build-douyin-curated-data.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDouyinRuleDetail } from "../src/crawler/douyinCrawler.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = "aHVWKjDmNiUv";
const detail = await fetchDouyinRuleDetail(slug);

if (!detail) {
  throw new Error("Failed to fetch seed rule detail");
}

const ruleTextPath = `data/douyin/rule-text/rule-${slug}.txt`;
const textFile = path.join(repoRoot, ruleTextPath);
await mkdir(path.dirname(textFile), { recursive: true });
await writeFile(textFile, detail.content, "utf8");

const sources = {
  version: 1,
  updatedAt: new Date().toISOString(),
  repoEditUrl: "https://github.com/Leiixin/tmall-rule-tracker/edit/main/data/douyin/curated-sources.json",
  sources: [
    {
      id: `dy-rule-${slug}`,
      slug,
      platform: "douyin",
      url: detail.url,
      label: detail.title,
      categories: ["shelf"],
      cardIds: ["shelf:0"],
      ruleTitle: detail.title,
      manualTextPath: ruleTextPath
    }
  ]
};

const cards = {
  version: 1,
  updatedAt: new Date().toISOString(),
  autoPublishVersion: 0,
  shelf: {
    tag: "SHELF-LIFE RULES",
    title: "商品效期要求",
    desc: `抖音电商商品与品牌规范相关规则（种子：${detail.title}）。`,
    cards: [
      {
        title: detail.title,
        severity: "warning",
        severityText: "规范",
        date: detail.publishedAt.slice(0, 10),
        tags: ["品牌", "限售"],
        link: detail.url,
        body: `<ul><li>${detail.content.slice(0, 500).replace(/</g, "&lt;")}…</li><li>完整正文见规则链接；卡片将在 sync:curated:douyin 后由 DeepSeek 重新生成。</li></ul>`,
        sourceId: `dy-rule-${slug}`,
        cardId: "shelf:0"
      }
    ]
  },
  score: {
    tag: "EXPERIENCE SCORE",
    title: "店铺真实体验分",
    desc: "抖音商家体验分规范卡片（等待 curated 同步）。",
    cards: []
  },
  ship: {
    tag: "SHIPPING TIMELINE",
    title: "发货时效",
    desc: "抖音发货与物流时效规范卡片（等待 curated 同步）。",
    cards: []
  },
  penalty: {
    tag: "VIOLATIONS & PENALTIES",
    title: "发货违规及处罚",
    desc: "抖音违规与处罚细则卡片（等待 curated 同步）。",
    cards: []
  }
};

const watch = {
  version: 1,
  lastCheckedAt: null,
  summary: { published: 0, changed: 0, errors: 0, insightsGenerated: 0 },
  sources: {},
  recentAutoPublish: null
};

const insights = {
  version: 1,
  updatedAt: new Date().toISOString(),
  categories: {}
};

async function writeBoth(name, data) {
  const json = JSON.stringify(data, null, 2);
  for (const base of [path.join(repoRoot, "data", "douyin"), path.join(repoRoot, "public", "data", "douyin")]) {
    await mkdir(base, { recursive: true });
    await writeFile(path.join(base, name), json, "utf8");
  }
}

await writeBoth("curated-sources.json", sources);
await writeBoth("curated-cards.json", cards);
await writeBoth("curated-watch.json", watch);
await writeBoth("curated-category-insights.json", insights);

for (const base of [path.join(repoRoot, "data", "douyin"), path.join(repoRoot, "public", "data", "douyin")]) {
  const rtDir = path.join(base, "rule-text");
  await mkdir(rtDir, { recursive: true });
  await writeFile(path.join(rtDir, `rule-${slug}.txt`), detail.content, "utf8");
}

console.log("seed ok", detail.title, detail.content.length);
