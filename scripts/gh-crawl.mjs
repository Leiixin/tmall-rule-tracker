import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dayjs from "dayjs";

import { crawlAllSources } from "../src/crawler/tmallCrawler.js";
import { normalizeRuleDetailUrl } from "../src/utils/ruleDetailUrl.js";
import {
  buildErrorReport,
  buildSourcesFromReport
} from "../src/utils/crawlSourceStatus.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function parsePlatform(argv) {
  for (const arg of argv) {
    if (arg.startsWith("--platform=")) {
      return arg.slice("--platform=".length);
    }
  }
  return process.env.PLATFORM_ID || "tmall";
}

const platform = parsePlatform(process.argv.slice(2));

if (platform === "intl" && !process.env.DATA_DIR) {
  process.env.DATA_DIR = path.join(repoRoot, "data", "intl");
}

if (platform === "douyin" && !process.env.DATA_DIR) {
  process.env.DATA_DIR = path.join(repoRoot, "data", "douyin");
}

const PLATFORM_CATEGORY_BUCKETS = {
  tmall: ["shelf", "score", "ship", "penalty"],
  intl: ["intl_expiry", "intl_logistics", "intl_qual", "intl_penalty"],
  douyin: ["shelf", "score", "ship", "penalty"]
};

function tmallTagToBucket(tag) {
  if (tag === "effectivePeriod") return "shelf";
  if (tag === "shopExperienceScore") return "score";
  if (tag === "shippingTimeliness") return "ship";
  if (tag === "shippingViolationPenalty") return "penalty";
  return null;
}

function resolveDataDir() {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(repoRoot, "data");
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `\uFEFF${JSON.stringify(value, null, 2)}`, "utf8");
}

function toYmd(iso) {
  const t = dayjs(iso);
  return t.isValid() ? t.format("YYYY-MM-DD") : "";
}

function buildCategorized(processedRules, timestamp, crawlPlatform) {
  const bucketKeys = PLATFORM_CATEGORY_BUCKETS[crawlPlatform] || PLATFORM_CATEGORY_BUCKETS.tmall;
  const categorized = Object.fromEntries(bucketKeys.map((key) => [key, []]));
  categorized.general = [];

  const toItem = (rule, category) => {
    const discoveredAt = rule.lastSeenAt || rule.publishedAt || timestamp;
    return {
      title: rule.title || "未命名规则",
      url: normalizeRuleDetailUrl(rule.url || ""),
      source: rule.source || "未知来源",
      category,
      discoveredAt,
      effectiveDate: toYmd(rule.publishedAt || rule.lastSeenAt || ""),
      summary: rule.snippet || ""
    };
  };

  for (const rule of processedRules) {
    const tags = Array.isArray(rule.tags) ? rule.tags : [];
    let matched = false;

    if (crawlPlatform === "tmall") {
      for (const tag of tags) {
        const bucket = tmallTagToBucket(tag);
        if (bucket && categorized[bucket]) {
          categorized[bucket].push(toItem(rule, bucket));
          matched = true;
        }
      }
    } else {
      for (const tag of bucketKeys) {
        if (tags.includes(tag)) {
          categorized[tag].push(toItem(rule, tag));
          matched = true;
        }
      }
    }

    if (!matched) {
      categorized.general.push(toItem(rule, "general"));
    }
  }

  return categorized;
}

function buildTimeline(rules, timestamp, limit = 16) {
  const sorted = [...rules].sort((a, b) => {
    const aTime = dayjs(a.publishedAt || a.lastSeenAt || 0).valueOf();
    const bTime = dayjs(b.publishedAt || b.lastSeenAt || 0).valueOf();
    return bTime - aTime;
  });

  const items = sorted.slice(0, limit).map((rule) => {
    const d = dayjs(rule.publishedAt || rule.lastSeenAt || timestamp);
    return {
      date: d.isValid() ? d.format("MM-DD") : "--",
      text: rule.title || "未命名规则",
      link: normalizeRuleDetailUrl(rule.url || "")
    };
  });

  return { lastUpdated: timestamp, items };
}

function publicDataDirFor(dataDir) {
  const rel = path.relative(path.join(repoRoot, "data"), dataDir);
  if (rel && !rel.startsWith("..") && rel !== ".") {
    return path.join(repoRoot, "public", "data", rel);
  }
  return path.join(repoRoot, "public", "data");
}

async function main() {
  const { classifyRules } = await import("../src/services/classifier.js");
  const { enrichRulesWithAiSummary } = await import("../src/services/llm/summarizer.js");
  const { loadRules, upsertRules } = await import("../src/services/storage.js");

  const dataDir = resolveDataDir();
  const statusPath = path.join(dataDir, "status.json");
  const scrapedPath = path.join(dataDir, "scraped.json");
  const timelinePath = path.join(dataDir, "timeline.json");
  const rulesPath = path.join(dataDir, "rules.json");
  const publicDataDir = publicDataDirFor(dataDir);

  const prevStatus = await readJson(statusPath, {});
  const prevFetchCount = Number(prevStatus.fetchCount || 0);

  const timestamp = new Date().toISOString();

  let crawled = [];
  let crawlReport = [];
  let merged = [];
  let errorMessage = null;

  const beforeRules = await loadRules();
  const beforeCount = beforeRules.length;

  let llmResult = null;

  try {
    const crawlResult = await crawlAllSources({ platform });
    crawled = crawlResult.rules;
    crawlReport = crawlResult.report;
    const classified = classifyRules(crawled, { platform });
    merged = await upsertRules(classified);

    if (merged.length) {
      const enrich = await enrichRulesWithAiSummary(merged, {
        previousRules: beforeRules,
        persist: true
      });
      merged = enrich.rules;
      llmResult = {
        summarized: enrich.summarized,
        skipped: enrich.skipped,
        errors: enrich.errors,
        disabled: enrich.disabled
      };
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "crawl failed";
    merged = beforeRules;
  }

  const processed = classifyRules(merged, { platform });
  const newRulesCount = Math.max(0, merged.length - beforeCount);
  const fetchCount = prevFetchCount + 1;

  const sources =
    errorMessage && crawled.length === 0
      ? buildSourcesFromReport(buildErrorReport(errorMessage, platform), timestamp, platform)
      : buildSourcesFromReport(crawlReport, timestamp, platform);

  const statusJson = {
    lastFetchTime: timestamp,
    fetchCount,
    totalRules: merged.length,
    newRulesCount,
    sources,
    platform
  };

  const scrapedJson = {
    lastUpdated: timestamp,
    categorized: buildCategorized(processed, timestamp, platform)
  };

  const timelineJson = buildTimeline(merged, timestamp);

  await writeJson(statusPath, statusJson);
  await writeJson(scrapedPath, scrapedJson);
  await writeJson(timelinePath, timelineJson);
  await writeJson(rulesPath, merged);

  try {
    await mkdir(publicDataDir, { recursive: true });
    await writeJson(path.join(publicDataDir, "status.json"), statusJson);
    await writeJson(path.join(publicDataDir, "scraped.json"), scrapedJson);
    await writeJson(path.join(publicDataDir, "timeline.json"), timelineJson);
    await writeJson(path.join(publicDataDir, "rules.json"), merged);
  } catch {
    // public/data may not exist in minimal checkouts
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: !errorMessage,
        platform,
        fetched: crawled.length,
        stored: merged.length,
        fetchCount,
        newRulesCount,
        errorMessage,
        llm: llmResult
      },
      null,
      2
    )
  );
}

await main();
