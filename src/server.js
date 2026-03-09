import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConclusions,
  buildDashboard,
  classifyRules,
  filterRulesByCategory
} from "./services/classifier.js";
import { buildSheetPresentation } from "./services/presentation.js";
import { getLastRunStatus, refreshRules, startScheduler } from "./services/scheduler.js";
import { ensureDataFile, loadRules } from "./services/storage.js";

const PORT = Number(process.env.PORT || 3000);
const ENABLE_INTERNAL_CRON = process.env.ENABLE_INTERNAL_CRON !== "false";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const app = express();

app.use(express.json());
app.use(express.static(publicDir));
app.use("/data", express.static(path.join(process.cwd(), "data")));

async function getProcessedRules() {
  const rules = await loadRules();
  return classifyRules(rules);
}

const legacyCategoryMap = {
  shelf: "effectivePeriod",
  score: "shopExperienceScore",
  ship: "shippingTimeliness",
  penalty: "shippingViolationPenalty"
};

function buildSourceStatus(status) {
  const sourceStatus = status?.timestamp ? "online" : "unknown";
  const lastCheck = status?.timestamp || null;

  return {
    天猫规则页: { status: sourceStatus, lastCheck },
    天猫规则中心: { status: sourceStatus, lastCheck },
    "淘宝大学-规则动态": { status: sourceStatus, lastCheck },
    真实体验分规范: { status: sourceStatus, lastCheck }
  };
}

function toLegacyRuleItem(rule, category) {
  return {
    title: rule.title || "未命名规则",
    url: rule.url || "",
    source: rule.source || "未知来源",
    category,
    discoveredAt: rule.lastSeenAt || rule.publishedAt || new Date().toISOString()
  };
}

function buildLegacyRulesPayload(rules, status) {
  const categorized = {
    shelf: [],
    score: [],
    ship: [],
    penalty: [],
    general: []
  };

  for (const rule of rules) {
    const tags = Array.isArray(rule.tags) ? rule.tags : [];
    let matched = false;

    if (tags.includes("effectivePeriod")) {
      categorized.shelf.push(toLegacyRuleItem(rule, "shelf"));
      matched = true;
    }
    if (tags.includes("shopExperienceScore")) {
      categorized.score.push(toLegacyRuleItem(rule, "score"));
      matched = true;
    }
    if (tags.includes("shippingTimeliness")) {
      categorized.ship.push(toLegacyRuleItem(rule, "ship"));
      matched = true;
    }
    if (tags.includes("shippingViolationPenalty")) {
      categorized.penalty.push(toLegacyRuleItem(rule, "penalty"));
      matched = true;
    }

    if (!matched) {
      categorized.general.push(toLegacyRuleItem(rule, "general"));
    }
  }

  return {
    fetchedRules: [
      ...categorized.shelf,
      ...categorized.score,
      ...categorized.ship,
      ...categorized.penalty,
      ...categorized.general
    ],
    fetchCount: status?.fetchCount || 0,
    sources: buildSourceStatus(status),
    categorized,
    lastFetchTime: status?.timestamp || null,
    newRulesCount: status?.newRulesCount || 0
  };
}

app.get("/api/health", async (_req, res) => {
  const rules = await loadRules();
  res.json({
    ok: true,
    totalRules: rules.length,
    now: new Date().toISOString()
  });
});

app.get("/api/status", async (_req, res) => {
  const rules = await loadRules();
  const scheduler = getLastRunStatus();

  res.json({
    scheduler,
    totalRules: rules.length,
    now: new Date().toISOString(),
    lastFetchTime: scheduler.timestamp || null,
    fetchCount: scheduler.fetchCount || 0,
    newRulesCount: scheduler.newRulesCount || 0,
    sources: buildSourceStatus(scheduler)
  });
});

app.get("/api/rules", async (req, res) => {
  const processed = await getProcessedRules();
  const scheduler = getLastRunStatus();
  const hasCategoryParam = Object.prototype.hasOwnProperty.call(req.query, "category");
  const hasLimitParam = Object.prototype.hasOwnProperty.call(req.query, "limit");

  // 兼容你提供的大屏模板：不带参数时返回 categorized 结构。
  if (!hasCategoryParam && !hasLimitParam) {
    res.json(buildLegacyRulesPayload(processed, scheduler));
    return;
  }

  const rawCategory = String(req.query.category || "");
  const category = legacyCategoryMap[rawCategory] || rawCategory;
  const limit = Number(req.query.limit || 80);
  const filtered = filterRulesByCategory(processed, category).slice(0, limit);

  res.json({
    total: filtered.length,
    items: filtered
  });
});

app.get("/api/dashboard", async (_req, res) => {
  const processed = await getProcessedRules();
  res.json(buildDashboard(processed));
});

app.get("/api/conclusions", async (_req, res) => {
  const processed = await getProcessedRules();
  res.json(buildConclusions(processed));
});

app.get("/api/presentation", async (_req, res) => {
  const processed = await getProcessedRules();
  res.json(buildSheetPresentation(processed));
});

app.post("/api/crawl", async (_req, res) => {
  const result = await refreshRules();
  res.json({
    message: "抓取完成",
    fetched: result.fetched,
    stored: result.stored,
    timestamp: result.timestamp,
    fetchCount: result.fetchCount || 0,
    newRulesCount: result.newRulesCount || 0
  });
});

app.post("/api/fetch", async (_req, res) => {
  try {
    const result = await refreshRules();
    res.json({
      success: true,
      newRules: result.newRulesCount || 0,
      totalRules: result.stored || 0,
      fetched: result.fetched || 0,
      lastFetchTime: result.timestamp || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "抓取失败"
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

async function bootstrap() {
  await ensureDataFile();

  try {
    await refreshRules();
  } catch {
    // Keep service alive even if initial crawl fails.
  }

  if (ENABLE_INTERNAL_CRON) {
    startScheduler();
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Tmall Rule Tracker listening on http://localhost:${PORT}`);
  });
}

bootstrap();
