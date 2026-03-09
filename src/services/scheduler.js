import cron from "node-cron";
import { CRON_EXPRESSION } from "../config.js";
import { crawlAllSources } from "../crawler/tmallCrawler.js";
import { classifyRules } from "./classifier.js";
import { loadRules, upsertRules } from "./storage.js";

let lastRun = null;
let fetchCount = 0;
let lastResult = {
  fetched: 0,
  stored: 0,
  timestamp: null,
  newRulesCount: 0
};

export async function refreshRules() {
  const beforeRules = await loadRules();
  const beforeCount = beforeRules.length;
  const crawled = await crawlAllSources();
  const classified = classifyRules(crawled);
  const merged = await upsertRules(classified);
  const newRulesCount = Math.max(0, merged.length - beforeCount);

  lastRun = new Date().toISOString();
  fetchCount += 1;
  lastResult = {
    fetched: crawled.length,
    stored: merged.length,
    timestamp: lastRun,
    newRulesCount
  };

  return {
    ...lastResult,
    fetchCount,
    data: merged
  };
}

export function getLastRunStatus() {
  return {
    lastRun,
    fetchCount,
    ...lastResult
  };
}

export function startScheduler() {
  cron.schedule(CRON_EXPRESSION, async () => {
    try {
      await refreshRules();
    } catch {
      // Keep scheduler alive even if one crawl fails.
    }
  }, {
    timezone: "Asia/Shanghai"
  });
}
