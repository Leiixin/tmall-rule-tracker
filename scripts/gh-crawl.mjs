import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import dayjs from "dayjs";

import { crawlAllSources } from "../src/crawler/tmallCrawler.js";
import { classifyRules } from "../src/services/classifier.js";
import { loadRules, upsertRules } from "../src/services/storage.js";

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
  // Write UTF-8 with BOM for Windows PowerShell / Notepad compatibility.
  await writeFile(filePath, `\uFEFF${JSON.stringify(value, null, 2)}`, "utf8");
}

function toYmd(iso) {
  const t = dayjs(iso);
  return t.isValid() ? t.format("YYYY-MM-DD") : "";
}

function buildSources(timestamp, status = "online", message = null) {
  const base = { status, lastCheck: timestamp };
  const extra = message ? { message } : {};
  return {
    "天猫规则页": { ...base, ...extra },
    "天猫规则中心": { ...base, ...extra },
    "淘宝大学-规则动态": { ...base, ...extra },
    "真实体验分规范": { ...base, ...extra }
  };
}

function buildCategorized(processedRules, timestamp) {
  const categorized = {
    shelf: [],
    score: [],
    ship: [],
    penalty: [],
    general: []
  };

  const toItem = (rule, category) => {
    const discoveredAt = rule.lastSeenAt || rule.publishedAt || timestamp;
    return {
      title: rule.title || "未命名规则",
      url: rule.url || "",
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

    if (tags.includes("effectivePeriod")) {
      categorized.shelf.push(toItem(rule, "shelf"));
      matched = true;
    }
    if (tags.includes("shopExperienceScore")) {
      categorized.score.push(toItem(rule, "score"));
      matched = true;
    }
    if (tags.includes("shippingTimeliness")) {
      categorized.ship.push(toItem(rule, "ship"));
      matched = true;
    }
    if (tags.includes("shippingViolationPenalty")) {
      categorized.penalty.push(toItem(rule, "penalty"));
      matched = true;
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
      link: rule.url || ""
    };
  });

  return { lastUpdated: timestamp, items };
}

async function main() {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), "data");

  const statusPath = path.join(dataDir, "status.json");
  const scrapedPath = path.join(dataDir, "scraped.json");
  const timelinePath = path.join(dataDir, "timeline.json");

  const prevStatus = await readJson(statusPath, {});
  const prevFetchCount = Number(prevStatus.fetchCount || 0);

  const timestamp = new Date().toISOString();

  let crawled = [];
  let merged = [];
  let errorMessage = null;

  const beforeRules = await loadRules();
  const beforeCount = beforeRules.length;

  try {
    crawled = await crawlAllSources();
    const classified = classifyRules(crawled);
    merged = await upsertRules(classified);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "crawl failed";
    // Keep previous data intact when crawl fails.
    merged = beforeRules;
  }

  const processed = classifyRules(merged);
  const newRulesCount = Math.max(0, merged.length - beforeCount);
  const fetchCount = prevFetchCount + 1;

  const sources =
    errorMessage && crawled.length === 0
      ? buildSources(timestamp, "error", errorMessage)
      : buildSources(timestamp, "online");

  const statusJson = {
    lastFetchTime: timestamp,
    fetchCount,
    totalRules: merged.length,
    newRulesCount,
    sources
  };

  const scrapedJson = {
    lastUpdated: timestamp,
    categorized: buildCategorized(processed, timestamp)
  };

  const timelineJson = buildTimeline(merged, timestamp);

  await writeJson(statusPath, statusJson);
  await writeJson(scrapedPath, scrapedJson);
  await writeJson(timelinePath, timelineJson);

  // Helpful for Actions logs.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: !errorMessage,
        fetched: crawled.length,
        stored: merged.length,
        fetchCount,
        newRulesCount,
        errorMessage
      },
      null,
      2
    )
  );
}

await main();
