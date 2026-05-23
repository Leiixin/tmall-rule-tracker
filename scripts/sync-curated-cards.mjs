import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchRuleDetailByRuleId } from "../src/crawler/tmallCrawler.js";
import { generateCuratedCardsForCategory } from "../src/services/llm/curatedCardsGenerator.js";
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
  await writeFile(filePath, `\uFEFF${JSON.stringify(value, null, 2)}`, "utf8");
}

function mergeCardsForSource(cards, category, sourceId, newCards) {
  const kept = (cards || []).filter((c) => c.sourceId !== sourceId);
  const merged = [...kept, ...newCards];
  merged.forEach((card, index) => {
    card.cardId = `${category}:${index}`;
  });
  return merged;
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

  const curatedCards = await readJson(cardsPath, null);
  const curatedSources = await readJson(sourcesPath, { sources: [] });
  const prevWatch = await readJson(watchPath, {});

  if (!curatedCards) {
    throw new Error("curated-cards.json missing; run node scripts/migrate-curated-data.mjs");
  }

  const timestamp = new Date().toISOString();
  const maxPublish = Number(process.env.LLM_MAX_CURATED_SOURCES_PER_RUN || 2);
  const llmOn = isLlmEnabled();
  const autoPublish =
    String(process.env.ENABLE_CURATED_AUTO_PUBLISH || "true").toLowerCase() !==
    "false";

  const watch = {
    lastCheckedAt: timestamp,
    autoPublishVersion: Number(prevWatch.autoPublishVersion || 0),
    recentAutoPublish: prevWatch.recentAutoPublish || null,
    sources: {},
    summary: { checked: 0, changed: 0, errors: 0, published: 0, synced: 0 }
  };

  let publishBudget = maxPublish;
  const changedQueue = [];

  for (const source of curatedSources.sources || []) {
    watch.summary.checked += 1;
    const prev = prevWatch.sources?.[source.id] || {};

    if (!source.ruleId) {
      watch.sources[source.id] = {
        status: "ok",
        message: "local card without ruleId",
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
          platformModifiedAt: prev.platformModifiedAt || null,
          contentHash: prev.contentHash || "",
          lastSyncedAt: prev.lastSyncedAt || null
        };
        watch.summary.errors += 1;
        continue;
      }

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
          platformModifiedAt,
          contentHash: hash,
          lastSyncedAt: prev.lastSyncedAt || null,
          detectedAt: timestamp
        };
        watch.summary.changed += 1;
        changedQueue.push({ source, detail, hash, platformModifiedAt });
      } else {
        watch.sources[source.id] = {
          status: "ok",
          message: "no change",
          platformModifiedAt,
          contentHash: hash,
          lastSyncedAt: prev.lastSyncedAt || null
        };
      }
    } catch (err) {
      watch.sources[source.id] = {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
        platformModifiedAt: prev.platformModifiedAt || null,
        contentHash: prev.contentHash || "",
        lastSyncedAt: prev.lastSyncedAt || null
      };
      watch.summary.errors += 1;
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
        watch.recentAutoPublish = {
          at: timestamp,
          sourceId: source.id,
          label: source.label,
          categories: source.categories
        };
        watch.sources[source.id] = {
          status: "synced",
          message: `auto-published ${publishedCategories} categor(ies)`,
          platformModifiedAt,
          contentHash: hash,
          lastSyncedAt: timestamp
        };
        curatedCards.updatedAt = timestamp;
        curatedCards.autoPublishVersion = watch.autoPublishVersion;
      }
    } catch (err) {
      watch.sources[source.id] = {
        status: "changed",
        message: `LLM publish failed: ${err instanceof Error ? err.message : err}`,
        platformModifiedAt,
        contentHash: hash,
        lastSyncedAt: prevWatch.sources?.[source.id]?.lastSyncedAt || null,
        detectedAt: timestamp
      };
      watch.summary.errors += 1;
    }
  }

  curatedCards.updatedAt = curatedCards.updatedAt || timestamp;

  await writeJson(cardsPath, curatedCards);
  await writeJson(sourcesPath, curatedSources);
  await writeJson(watchPath, watch);

  await mkdir(publicDataDir, { recursive: true });
  await writeJson(path.join(publicDataDir, "curated-cards.json"), curatedCards);
  await writeJson(path.join(publicDataDir, "curated-sources.json"), curatedSources);
  await writeJson(path.join(publicDataDir, "curated-watch.json"), watch);

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
