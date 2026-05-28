/**
 * Curated 分类页同步。默认读写 data/ 根目录（天猫平台）。
 * 国际或其它平台：
 *   --platform=intl  或 PLATFORM_ID=intl  或 CURATED_DATA_PREFIX=intl/
 *   --force-source=intl-rule-11005234  强制 DeepSeek 重生成该来源卡片
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

import { fetchRuleDetailByRuleId } from "../src/crawler/tmallCrawler.js";
import { generateCuratedCardsForCategory } from "../src/services/llm/curatedCardsGenerator.js";
import { generateCategoryInsights } from "../src/services/llm/curatedCategoryInsightsGenerator.js";
import { isLlmEnabled } from "../src/services/llm/client.js";

const TMALL_CATEGORY_KEYS = ["shelf", "score", "ship", "penalty"];
const INTL_CATEGORY_KEYS = [
  "intl_expiry",
  "intl_logistics",
  "intl_qual",
  "intl_penalty"
];

function contentHash(text) {
  return createHash("sha256")
    .update(String(text || ""))
    .digest("hex")
    .slice(0, 16);
}

function parseCli(argv) {
  let platform = process.env.PLATFORM_ID || "";
  let curatedPrefix = process.env.CURATED_DATA_PREFIX || "";
  const forceSourceIds = new Set();

  for (const arg of argv) {
    if (arg.startsWith("--platform=")) {
      platform = arg.slice("--platform=".length);
    } else if (arg.startsWith("--force-source=")) {
      forceSourceIds.add(arg.slice("--force-source=".length));
    }
  }

  const envForce = process.env.FORCE_CURATED_SOURCE_IDS || "";
  envForce
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((id) => forceSourceIds.add(id));

  if (!curatedPrefix && platform === "intl") {
    curatedPrefix = "intl/";
  }
  if (curatedPrefix && !curatedPrefix.endsWith("/")) {
    curatedPrefix += "/";
  }

  const categoryKeys =
    curatedPrefix === "intl/" ? INTL_CATEGORY_KEYS : TMALL_CATEGORY_KEYS;

  return { curatedPrefix, categoryKeys, forceSourceIds };
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function applyRuleTitle(source, detail) {
  const title = String(detail?.title || "").trim();
  if (title) {
    source.ruleTitle = title;
  }
}

function resolveRuleTitle(source, prev) {
  return source.ruleTitle || prev.ruleTitle || "";
}

function mergeCardsForSource(cards, category, sourceId, newCards) {
  const kept = (cards || []).filter((c) => c.sourceId !== sourceId);
  const merged = [...kept, ...newCards];
  merged.forEach((card, index) => {
    card.cardId = `${category}:${index}`;
  });
  return merged;
}

function updateSourceCache(cache, sourceId, detail) {
  if (!cache.sources) {
    cache.sources = {};
  }
  cache.sources[sourceId] = {
    ruleId: detail.ruleId,
    title: detail.title,
    content: detail.content,
    fetchedAt: detail.crawledAt || new Date().toISOString(),
    origin: "mtop"
  };
  cache.updatedAt = new Date().toISOString();
}

function copyPrevWatchEntry(prev, source, prevWatch) {
  const p = prevWatch.sources?.[source.id] || prev;
  return {
    status: p.status || "ok",
    message: p.message || "skipped (force run for other sources)",
    ruleTitle: resolveRuleTitle(source, p),
    platformModifiedAt: p.platformModifiedAt || null,
    contentHash: p.contentHash || "",
    lastSyncedAt: p.lastSyncedAt || null
  };
}

async function notifyIfChanged(watch) {
  const url = process.env.NOTIFY_WEBHOOK_URL || "";
  if (!url) {
    return;
  }
  const changed = Object.values(watch.sources || {}).filter(
    (s) => s.status === "changed" || s.status === "synced"
  );
  if (!changed.length && !watch.recentAutoPublish) {
    return;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `天猫规则监控：分类页引用规则检查完成。已发布 ${watch.summary?.published || 0}，变更待处理 ${watch.summary?.changed || 0}，错误 ${watch.summary?.errors || 0}。`,
        watch: {
          lastCheckedAt: watch.lastCheckedAt,
          recentAutoPublish: watch.recentAutoPublish
        }
      })
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[curated] notify webhook failed:",
      err instanceof Error ? err.message : err
    );
  }
}

async function publishCardsForSource({
  source,
  detail,
  hash,
  platformModifiedAt,
  curatedCards,
  categoryKeys,
  watch,
  prevWatch,
  timestamp,
  publishBudget
}) {
  let publishedCategories = 0;

  for (const category of source.categories || []) {
    if (!categoryKeys.includes(category)) {
      continue;
    }
    const { cards } = await generateCuratedCardsForCategory({
      category,
      detail,
      source
    });
    if (!curatedCards[category]) {
      throw new Error(`curated-cards.json missing category: ${category}`);
    }
    curatedCards[category].cards = mergeCardsForSource(
      curatedCards[category].cards,
      category,
      source.id,
      cards
    );
    publishedCategories += 1;
  }

  if (publishedCategories > 0) {
    watch.summary.published += 1;
    watch.summary.synced += 1;
    watch.autoPublishVersion += 1;
    const displayTitle = source.ruleTitle || source.label || source.id;
    watch.recentAutoPublish = {
      at: timestamp,
      sourceId: source.id,
      ruleTitle: displayTitle,
      label: displayTitle,
      categories: source.categories
    };
    watch.sources[source.id] = {
      status: "synced",
      message: `auto-published ${publishedCategories} categor(ies)`,
      ruleTitle: resolveRuleTitle(source, prevWatch.sources?.[source.id] || {}),
      platformModifiedAt,
      contentHash: hash,
      lastSyncedAt: timestamp,
      insightsGeneratedAt:
        watch.sources[source.id]?.insightsGeneratedAt || timestamp
    };
    curatedCards.updatedAt = timestamp;
    curatedCards.autoPublishVersion = watch.autoPublishVersion;
    return publishBudget - 1;
  }

  return publishBudget;
}

async function main() {
  const root = process.cwd();
  const { curatedPrefix, categoryKeys, forceSourceIds } = parseCli(
    process.argv.slice(2)
  );
  const forceOnly = forceSourceIds.size > 0;

  const baseDataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(root, "data");
  const dataDir = curatedPrefix
    ? path.join(baseDataDir, curatedPrefix.replace(/\/$/, ""))
    : baseDataDir;
  const publicDataDir = curatedPrefix
    ? path.join(root, "public", "data", curatedPrefix.replace(/\/$/, ""))
    : path.join(root, "public", "data");

  const cardsPath = path.join(dataDir, "curated-cards.json");
  const sourcesPath = path.join(dataDir, "curated-sources.json");
  const watchPath = path.join(dataDir, "curated-watch.json");
  const insightsPath = path.join(dataDir, "curated-category-insights.json");
  const cachePath = path.join(dataDir, "curated-source-cache.json");

  const curatedCards = await readJson(cardsPath, null);
  const curatedSources = await readJson(sourcesPath, { sources: [] });
  const prevWatch = await readJson(watchPath, {});
  const curatedInsights = await readJson(insightsPath, {
    version: 1,
    categories: {}
  });
  const sourceCache = await readJson(cachePath, { version: 1, sources: {} });

  if (!curatedCards) {
    throw new Error(
      `curated-cards.json missing at ${cardsPath}; run migrate or create intl data`
    );
  }

  const timestamp = new Date().toISOString();
  const maxPublish = Number(process.env.LLM_MAX_CURATED_SOURCES_PER_RUN || 2);
  const maxInsights = Number(process.env.LLM_MAX_INSIGHTS_PER_RUN || 2);
  const llmOn = isLlmEnabled();
  const autoPublish =
    String(process.env.ENABLE_CURATED_AUTO_PUBLISH || "true").toLowerCase() !==
    "false";

  if (forceOnly && !llmOn) {
    throw new Error(
      "LLM disabled: set ENABLE_LLM_SUMMARY=true and DEEPSEEK_API_KEY for --force-source"
    );
  }

  const watch = {
    lastCheckedAt: timestamp,
    autoPublishVersion: Number(prevWatch.autoPublishVersion || 0),
    recentAutoPublish: prevWatch.recentAutoPublish || null,
    sources: {},
    summary: {
      checked: 0,
      changed: 0,
      errors: 0,
      published: 0,
      synced: 0,
      insightsGenerated: 0,
      forced: forceSourceIds.size
    }
  };

  let publishBudget = forceOnly
    ? Math.max(maxPublish, forceSourceIds.size)
    : maxPublish;
  let insightsBudget = maxInsights;
  const changedQueue = [];

  for (const source of curatedSources.sources || []) {
    if (!String(source.url || "").trim()) {
      continue;
    }

    const forceRegenerate = forceSourceIds.has(source.id);
    if (forceOnly && !forceRegenerate) {
      watch.sources[source.id] = copyPrevWatchEntry({}, source, prevWatch);
      continue;
    }

    watch.summary.checked += 1;
    const prev = prevWatch.sources?.[source.id] || {};
    const previousContent = sourceCache.sources?.[source.id]?.content || "";

    if (!source.ruleId) {
      watch.sources[source.id] = {
        status: "ok",
        message: "local card without ruleId",
        ruleTitle: resolveRuleTitle(source, prev),
        platformModifiedAt: prev.platformModifiedAt || null,
        contentHash: prev.contentHash || "",
        lastSyncedAt: prev.lastSyncedAt || null
      };
      continue;
    }

    try {
      const detail = await fetchRuleDetailByRuleId(source.ruleId);
      if (!detail) {
        watch.sources[source.id] = {
          status: "error",
          message: "MTOP detail fetch failed",
          ruleTitle: resolveRuleTitle(source, prev),
          platformModifiedAt: prev.platformModifiedAt || null,
          contentHash: prev.contentHash || "",
          lastSyncedAt: prev.lastSyncedAt || null
        };
        watch.summary.errors += 1;
        continue;
      }

      updateSourceCache(sourceCache, source.id, detail);

      applyRuleTitle(source, detail);
      const ruleTitle = resolveRuleTitle(source, prev);

      const hash = contentHash(detail.content);
      const platformModifiedAt = detail.publishedAt;
      const contentChanged =
        !prev.contentHash ||
        prev.contentHash !== hash ||
        (prev.platformModifiedAt &&
          prev.platformModifiedAt !== platformModifiedAt);

      if (contentChanged || forceRegenerate) {
        watch.sources[source.id] = {
          status: "changed",
          message: forceRegenerate
            ? "force regenerate"
            : "platform content or revision changed",
          ruleTitle,
          platformModifiedAt,
          contentHash: hash,
          lastSyncedAt: prev.lastSyncedAt || null,
          detectedAt: timestamp
        };
        watch.summary.changed += 1;
        changedQueue.push({
          source,
          detail,
          hash,
          platformModifiedAt,
          previousContent
        });
      } else {
        watch.sources[source.id] = {
          status: "ok",
          message: "no change",
          ruleTitle,
          platformModifiedAt,
          contentHash: hash,
          lastSyncedAt: prev.lastSyncedAt || null
        };
      }
    } catch (err) {
      watch.sources[source.id] = {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
        ruleTitle: resolveRuleTitle(source, prev),
        platformModifiedAt: prev.platformModifiedAt || null,
        contentHash: prev.contentHash || "",
        lastSyncedAt: prev.lastSyncedAt || null
      };
      watch.summary.errors += 1;
    }
  }

  for (const item of changedQueue) {
    if (llmOn && insightsBudget > 0) {
      const { source, detail, platformModifiedAt, previousContent } = item;
      let generatedForSource = 0;

      for (const category of source.categories || []) {
        if (!categoryKeys.includes(category)) {
          continue;
        }
        if (String(category).startsWith("intl_")) {
          continue;
        }
        const existing = curatedInsights.categories?.[category];
        if (existing?.pinned) {
          continue;
        }
        try {
          const { block } = await generateCategoryInsights({
            category,
            detail,
            source,
            previousContent
          });
          if (!curatedInsights.categories) {
            curatedInsights.categories = {};
          }
          curatedInsights.categories[category] = block;
          generatedForSource += 1;
          watch.summary.insightsGenerated += 1;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            `[curated] insights failed ${category}/${source.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      if (generatedForSource > 0) {
        insightsBudget -= 1;
        const entry = watch.sources[source.id] || {};
        watch.sources[source.id] = {
          ...entry,
          insightsGeneratedAt: timestamp
        };
      }
    }
  }

  for (const item of changedQueue) {
    if (!llmOn || !autoPublish || publishBudget <= 0) {
      continue;
    }

    const { source, detail, hash, platformModifiedAt } = item;

    try {
      publishBudget = await publishCardsForSource({
        source,
        detail,
        hash,
        platformModifiedAt,
        curatedCards,
        categoryKeys,
        watch,
        prevWatch,
        timestamp,
        publishBudget
      });
    } catch (err) {
      const prevEntry = prevWatch.sources?.[source.id] || {};
      watch.sources[source.id] = {
        status: "changed",
        message: `LLM publish failed: ${err instanceof Error ? err.message : err}`,
        ruleTitle: resolveRuleTitle(source, prevEntry),
        platformModifiedAt,
        contentHash: hash,
        lastSyncedAt: prevEntry.lastSyncedAt || null,
        detectedAt: timestamp,
        insightsGeneratedAt: prevEntry.insightsGeneratedAt || null
      };
      watch.summary.errors += 1;
    }
  }

  curatedCards.updatedAt = curatedCards.updatedAt || timestamp;
  curatedInsights.version = 1;
  curatedInsights.updatedAt = timestamp;

  await writeJson(cardsPath, curatedCards);
  await writeJson(sourcesPath, curatedSources);
  await writeJson(watchPath, watch);
  await writeJson(insightsPath, curatedInsights);
  await writeJson(cachePath, sourceCache);

  await mkdir(publicDataDir, { recursive: true });
  await writeJson(path.join(publicDataDir, "curated-cards.json"), curatedCards);
  await writeJson(
    path.join(publicDataDir, "curated-sources.json"),
    curatedSources
  );
  await writeJson(path.join(publicDataDir, "curated-watch.json"), watch);
  await writeJson(
    path.join(publicDataDir, "curated-category-insights.json"),
    curatedInsights
  );
  if (Object.keys(sourceCache.sources || {}).length) {
    await writeJson(
      path.join(publicDataDir, "curated-source-cache.json"),
      sourceCache
    );
  }

  await notifyIfChanged(watch);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        dataDir,
        llm: llmOn,
        autoPublish,
        ...watch.summary,
        autoPublishVersion: watch.autoPublishVersion
      },
      null,
      2
    )
  );
}

await main();
