/**
 * 回填抖音公告类 rules.json 的 publishedAt（article/detail update_timestamp）
 * 用法: node scripts/repair-douyin-weekly-published-at.mjs
 *       node scripts/repair-douyin-weekly-published-at.mjs --dry-run
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDouyinAnnouncementLikeSource } from "../src/utils/weeklyEligibility.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://school.jinritemai.com";
const GRAPH_ID = 312;

const dryRun = process.argv.includes("--dry-run");

function pickArticleTimestamp(info) {
  if (!info) {
    return null;
  }
  return (
    info.update_timestamp ||
    info.create_timestamp ||
    info.update_at ||
    info.create_at ||
    info.update_time
  );
}

function unixToIso(sec) {
  if (!sec) {
    return "";
  }
  const parsed = new Date(Number(sec) * 1000);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

async function fetchPublishedAt(slug) {
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
  const ts = pickArticleTimestamp(payload.data?.article_info);
  return ts ? unixToIso(ts) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rulesPath = path.join(repoRoot, "data", "douyin", "rules.json");
const publicRulesPath = path.join(repoRoot, "public", "data", "douyin", "rules.json");

const raw = await readFile(rulesPath, "utf8");
const rules = JSON.parse(raw.replace(/^\uFEFF/, ""));

const targets = rules.filter((rule) => isDouyinAnnouncementLikeSource(rule));
const results = { updated: 0, skipped: 0, failed: 0, samples: [] };

for (let i = 0; i < targets.length; i += 1) {
  const rule = targets[i];
  const prev = rule.publishedAt;
  try {
    const next = await fetchPublishedAt(rule.id);
    if (!next) {
      results.skipped += 1;
      continue;
    }
    if (prev === next) {
      results.skipped += 1;
      continue;
    }
    if (!dryRun) {
      rule.publishedAt = next;
    }
    results.updated += 1;
    if (results.samples.length < 5) {
      results.samples.push({
        id: rule.id,
        title: rule.title?.slice(0, 40),
        prev,
        next
      });
    }
  } catch (err) {
    results.failed += 1;
    if (results.samples.length < 8) {
      results.samples.push({
        id: rule.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  if ((i + 1) % 25 === 0) {
    // eslint-disable-next-line no-console
    console.log(`[repair] ${i + 1}/${targets.length}...`);
  }
  await sleep(80);
}

if (!dryRun) {
  const json = `\uFEFF${JSON.stringify(rules, null, 2)}`;
  await writeFile(rulesPath, json, "utf8");
  await mkdir(path.dirname(publicRulesPath), { recursive: true });
  await writeFile(publicRulesPath, json, "utf8");
}

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun,
      targets: targets.length,
      ...results
    },
    null,
    2
  )
);
