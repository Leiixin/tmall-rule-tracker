/**
 * 校正 curated-watch.json 中 platformModifiedAt / lastSyncedAt
 * 用法:
 *   node scripts/sync-douyin-curated-watch-dates.mjs --category=penalty
 *   node scripts/sync-douyin-curated-watch-dates.mjs --set-sync-now
 *
 * 日常变更检测与 DeepSeek 重写以 sync-curated-cards.mjs 为准；本脚本用于手工校正时间戳。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractBodyPublicationFingerprint } from "../src/utils/curatedChangeDetection.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://school.jinritemai.com";
const GRAPH_ID = 312;

function parseArgs(argv) {
  let category = null;
  let setSyncNow = false;
  for (const arg of argv) {
    if (arg.startsWith("--category=")) {
      category = arg.slice("--category=".length);
    } else if (arg === "--set-sync-now") {
      setSyncNow = true;
    }
  }
  return { category, setSyncNow };
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

/** @deprecated use extractBodyPublicationFingerprint; kept for rule-text fallback */
function parseChineseDateToIso(text) {
  const fp = extractBodyPublicationFingerprint("", text);
  const revision = fp.match(/revision:(\d{4}-\d{2}-\d{2})/);
  if (revision) {
    return new Date(`${revision[1]}T00:00:00.000Z`).toISOString();
  }
  const effective = fp.match(/effective:(\d{4}-\d{2}-\d{2})/);
  if (effective) {
    return new Date(`${effective[1]}T00:00:00.000Z`).toISOString();
  }
  return null;
}

async function fetchArticleMeta(slug) {
  const url = new URL("/api/eschool/v2/library/article/detail", BASE_URL);
  url.searchParams.set("id", slug);
  url.searchParams.set("graphId", String(GRAPH_ID));
  url.searchParams.set("need_content", "false");
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: `${BASE_URL}/doudian/web/article/${slug}`,
      Origin: BASE_URL
    }
  });
  const payload = await response.json();
  if (payload?.code !== 0) {
    throw new Error(payload?.msg || `code ${payload?.code}`);
  }
  const info = payload.data?.article_info;
  const ts =
    info?.update_timestamp ||
    info?.create_timestamp ||
    info?.update_at ||
    info?.create_at;
  return {
    ruleTitle: normalizeText(info?.name || ""),
    platformModifiedAt: ts ? new Date(Number(ts) * 1000).toISOString() : null
  };
}

async function readJson(relPath, fallback) {
  try {
    const raw = await readFile(path.join(repoRoot, relPath), "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function loadRulesBySlug() {
  const rules = await readJson("data/douyin/rules.json", []);
  const map = new Map();
  for (const rule of rules) {
    const id = String(rule.id || "");
    if (id) map.set(id, rule);
  }
  return map;
}

async function resolvePlatformModifiedAt(source, rulesBySlug) {
  const slug = source.slug || source.ruleId;
  if (!slug) return { platformModifiedAt: null, from: "none" };

  try {
    const meta = await fetchArticleMeta(slug);
    if (meta.platformModifiedAt) {
      return {
        platformModifiedAt: meta.platformModifiedAt,
        from: "api",
        ruleTitle: meta.ruleTitle
      };
    }
  } catch {
    // fall through
  }

  const textPath = source.manualTextPath
    ? path.join(repoRoot, source.manualTextPath)
    : path.join(repoRoot, "data", "douyin", "rule-text", `rule-${slug}.txt`);
  try {
    const text = await readFile(textPath, "utf8");
    const parsed = parseChineseDateToIso(text);
    if (parsed) {
      return { platformModifiedAt: parsed, from: "rule-text" };
    }
  } catch {
    // fall through
  }

  const rule = rulesBySlug.get(String(slug));
  if (rule?.publishedAt) {
    return { platformModifiedAt: rule.publishedAt, from: "rules.json" };
  }

  return { platformModifiedAt: null, from: "none" };
}

const { category, setSyncNow } = parseArgs(process.argv.slice(2));
const now = new Date().toISOString();

const sourcesDoc = await readJson("data/douyin/curated-sources.json", { sources: [] });
const watchDoc = await readJson("data/douyin/curated-watch.json", {
  sources: {},
  summary: {}
});
const rulesBySlug = await loadRulesBySlug();

let targets = sourcesDoc.sources.filter((s) => s.platform === "douyin" && (s.slug || s.ruleId));
if (category) {
  targets = targets.filter((s) => (s.categories || []).includes(category));
}

const results = [];
for (const source of targets) {
  const prev = watchDoc.sources[source.id] || {};
  const resolved = await resolvePlatformModifiedAt(source, rulesBySlug);

  const entry = {
    ...prev,
    ruleTitle: resolved.ruleTitle || source.ruleTitle || prev.ruleTitle || source.label,
    platformModifiedAt: resolved.platformModifiedAt || prev.platformModifiedAt || null
  };

  if (setSyncNow) {
    entry.lastSyncedAt = now;
  } else if (!entry.lastSyncedAt && prev.lastSyncedAt) {
    entry.lastSyncedAt = prev.lastSyncedAt;
  }

  watchDoc.sources[source.id] = entry;
  results.push({
    id: source.id,
    slug: source.slug,
    platformModifiedAt: entry.platformModifiedAt,
    lastSyncedAt: entry.lastSyncedAt,
    from: resolved.from
  });
}

watchDoc.lastCheckedAt = now;

for (const dir of [
  path.join(repoRoot, "data", "douyin"),
  path.join(repoRoot, "public", "data", "douyin")
]) {
  await mkdir(dir, { recursive: true });
  const json = `\uFEFF${JSON.stringify(watchDoc, null, 2)}`;
  await writeFile(path.join(dir, "curated-watch.json"), json, "utf8");
}

console.log(JSON.stringify({ ok: true, updated: results.length, results }, null, 2));
