/**
 * Curated 分类页同步。默认读写 data/ 根目录（天猫平台）。
 * 国际或其它平台预留：
 *   CURATED_DATA_PREFIX=intl/  → data/intl/curated-sources.json 等
 *   PLATFORM_ID=intl           → 同上（与 CURATED_DATA_PREFIX 二选一）
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchRuleDetailByRuleId } from "../src/crawler/tmallCrawler.js";
import { generateCuratedCardsForCategory } from "../src/services/llm/curatedCardsGenerator.js";
import { generateCategoryInsights } from "../src/services/llm/curatedCategoryInsightsGenerator.js";
import { isLlmEnabled } from "../src/services/llm/client.js";

const CATEGORY_KEYS = ["shelf", "score", "ship", "penalty"];

function contentHash(text) {
  return createHash("sha256")
    .update(String(text || ""))
    .digest("hex")
    .slice(0, 16);
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

async function main() {
  const root = process.cwd();
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(root, "data");
  const publicDataDir = path.join(root, "public", "data");

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
    throw new Error("curated-cards.json missing; run node scripts/migrate-curated-data.mjs");
  }

  const timestamp = new Date().toISOString();
  const maxPublish = Number(process.env.LLM_MAX_CURATED_SOURCES_PER_RUN || 2);
  const maxInsights = Number(process.env.LLM_MAX_INSIGHTS_PER_RUN || 2);
  const llmOn = isLlmEnabled();
  const autoPublish =
    String(process.env.ENABLE_CURATED_AUTO_PUBLISH || "true").toLowerCase() !==
    "false";

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
      insightsGenerated: 0
    }
  };

  let publishBudget = maxPublish;
  let insightsBudget = maxInsights;
  const changedQueue = [];

  for (const source of curatedSources.sources || []) {
    if (!String(source.url || "").trim()) {
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
      const changed =
        !prev.contentHash ||
        prev.contentHash !== hash ||
        (prev.platformModifiedAt &&
          prev.platformModifiedAt !== platformModifiedAt);

      if (changed) {
        watch.sources[source.id] = {
          status: "changed",
          message: "platform content or revision changed",
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
        if (!CATEGORY_KEYS.includes(category)) {
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
    let publishedCategories = 0;

    try {
      for (const category of source.categories || []) {
        if (!CATEGORY_KEYS.includes(category)) {
          continue;
        }
        const { cards } = await generateCuratedCardsForCategory({
          category,
          detail,
          source
        });
        curatedCards[category].cards = mergeCardsForSource(
          curatedCards[category].cards,
          category,
          source.id,
          cards
        );
        publishedCategories += 1;
      }

      if (publishedCategories > 0) {
        publishBudget -= 1;
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
      }
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
  await writeJson(path.join(publicDataDir, "curated-sources.json"), curatedSources);
  await writeJson(path.join(publicDataDir, "curated-watch.json"), watch);
  await writeJson(
    path.join(publicDataDir, "curated-category-insights.json"),
    curatedInsights
  );

  await notifyIfChanged(watch);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
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
