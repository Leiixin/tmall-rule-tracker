import cron from "node-cron";
import { CRON_EXPRESSION } from "../config.js";
import { crawlAllSources } from "../crawler/tmallCrawler.js";
import { classifyRules } from "./classifier.js";
import { enrichRulesWithAiSummary } from "./llm/summarizer.js";
import { loadRules, upsertRules } from "./storage.js";
import { loadStatusSnapshot, saveStatusSnapshot } from "./statusStore.js";

let lastRun = null;
let fetchCount = 0;
let lastResult = {
  fetched: 0,
  stored: 0,
  timestamp: null,
  newRulesCount: 0
};

let hydrated = false;

async function ensureHydrated() {
  if (hydrated) {
    return;
  }
  const fileStatus = await loadStatusSnapshot();
  if (fileStatus) {
    fetchCount = Number(fileStatus.fetchCount || 0);
    lastRun = fileStatus.lastFetchTime || null;
    lastResult = {
      fetched: 0,
      stored: Number(fileStatus.totalRules || 0),
      timestamp: lastRun,
      newRulesCount: Number(fileStatus.newRulesCount || 0)
    };
  }
  hydrated = true;
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

export async function refreshRules() {
  const beforeRules = await loadRules();
  const beforeCount = beforeRules.length;
  const crawled = await crawlAllSources();
  const classified = classifyRules(crawled);
  let merged = await upsertRules(classified);
  const enrich = await enrichRulesWithAiSummary(merged, {
    previousRules: beforeRules,
    persist: true
  });
  merged = enrich.rules;
  const newRulesCount = Math.max(0, merged.length - beforeCount);

  const prevStatus = await loadStatusSnapshot();
  const prevFetchCount = Number(prevStatus?.fetchCount || fetchCount || 0);

  lastRun = new Date().toISOString();
  fetchCount = prevFetchCount + 1;
  lastResult = {
    fetched: crawled.length,
    stored: merged.length,
    timestamp: lastRun,
    newRulesCount
  };

  await saveStatusSnapshot({
    lastFetchTime: lastRun,
    fetchCount,
    totalRules: merged.length,
    newRulesCount,
    sources: buildSources(lastRun, "online")
  });

  return {
    ...lastResult,
    fetchCount,
    data: merged
  };
}

export async function getLastRunStatus() {
  await ensureHydrated();
  const fileStatus = await loadStatusSnapshot();
  const memory = {
    lastRun,
    fetchCount,
    ...lastResult
  };

  if (!fileStatus) {
    return memory;
  }

  const fileTime = fileStatus.lastFetchTime
    ? new Date(fileStatus.lastFetchTime).getTime()
    : 0;
  const memoryTime = memory.timestamp ? new Date(memory.timestamp).getTime() : 0;

  if (fileTime >= memoryTime) {
    return {
      lastRun: fileStatus.lastFetchTime || null,
      fetchCount: Number(fileStatus.fetchCount || 0),
      fetched: memory.fetched,
      stored: Number(fileStatus.totalRules || memory.stored || 0),
      timestamp: fileStatus.lastFetchTime || null,
      newRulesCount: Number(fileStatus.newRulesCount || 0),
      sources: fileStatus.sources || null,
      totalRules: Number(fileStatus.totalRules || 0)
    };
  }

  return memory;
}

export function startScheduler() {
  void ensureHydrated();
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
