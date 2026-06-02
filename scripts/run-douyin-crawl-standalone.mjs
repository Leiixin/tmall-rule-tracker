import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDouyinTimelineJson,
  crawlDouyinRules
} from "../src/crawler/douyinCrawler.js";
import { DOUYIN_CATEGORY_KEYWORDS } from "../src/config.js";

function detectTags(text) {
  return Object.entries(DOUYIN_CATEGORY_KEYWORDS)
    .filter(([, keywords]) => keywords.some((kw) => text.includes(kw)))
    .map(([key]) => key);
}

function classifyDouyinRules(rules) {
  return rules.map((rule) => {
    const text = `${rule.title || ""} ${rule.content || ""}`;
    return {
      ...rule,
      tags: detectTags(text),
      snippet: (rule.content || rule.snippet || "").slice(0, 220)
    };
  });
}

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, "data", "douyin");
const publicDir = path.join(repoRoot, "public", "data", "douyin");

function toYmd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function buildCategorized(rules, timestamp) {
  const buckets = {
    shelf: [],
    score: [],
    ship: [],
    penalty: [],
    general: []
  };
  for (const rule of rules) {
    const tags = rule.tags || [];
    let matched = false;
    for (const tag of ["shelf", "score", "ship", "penalty"]) {
      if (tags.includes(tag)) {
        buckets[tag].push({
          title: rule.title,
          url: rule.url,
          source: rule.source,
          category: tag,
          discoveredAt: rule.lastSeenAt || timestamp,
          effectiveDate: toYmd(rule.publishedAt),
          summary: rule.snippet || ""
        });
        matched = true;
      }
    }
    if (!matched) {
      buckets.general.push({
        title: rule.title,
        url: rule.url,
        source: rule.source,
        category: "general",
        discoveredAt: rule.lastSeenAt || timestamp,
        effectiveDate: toYmd(rule.publishedAt),
        summary: rule.snippet || ""
      });
    }
  }
  return buckets;
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `\uFEFF${JSON.stringify(value, null, 2)}`, "utf8");
}

const timestamp = new Date().toISOString();
const crawlResult = await crawlDouyinRules({ returnReport: true });
const crawled = crawlResult.rules;
const classified = classifyDouyinRules(crawled);
const dynamicsCount = classified.filter((r) =>
  String(r.source || "").includes("规则动态")
).length;

const status = {
  lastFetchTime: timestamp,
  fetchCount: 1,
  totalRules: classified.length,
  newRulesCount: classified.length,
  platform: "douyin",
  sources: {
    "抖音电商规则中心": {
      status: classified.length > 0 ? "online" : "error",
      lastCheck: timestamp,
      count: classified.length
    },
    "规则动态/11688": {
      status: dynamicsCount > 0 ? "online" : "error",
      lastCheck: timestamp,
      count: dynamicsCount,
      pagesFetched: crawlResult.dynamicsReport?.pagesFetched ?? 0,
      totalFromApi: crawlResult.dynamicsReport?.totalFromApi ?? 0
    }
  }
};

const scraped = {
  lastUpdated: timestamp,
  categorized: buildCategorized(classified, timestamp)
};

const timeline = await buildDouyinTimelineJson(timestamp);

for (const dir of [dataDir, publicDir]) {
  await writeJson(path.join(dir, "status.json"), status);
  await writeJson(path.join(dir, "scraped.json"), scraped);
  await writeJson(path.join(dir, "timeline.json"), timeline);
  await writeJson(path.join(dir, "rules.json"), classified);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      fetched: crawled.length,
      withContent: classified.filter((r) => (r.content || "").length > 80).length
    },
    null,
    2
  )
);
