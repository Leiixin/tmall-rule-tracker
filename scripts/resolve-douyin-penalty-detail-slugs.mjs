/**
 * 解析 101706 引用的发货违规实施细则 article slug
 * 用法: node scripts/resolve-douyin-penalty-detail-slugs.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://school.jinritemai.com";
const GRAPH_ID = 312;
const ROOT_NODE_ID = 7236;
const PAGE_SIZE = 50;
const MAX_PAGES = 12;

const TARGETS = [
  {
    key: "ship_timeout",
    label: "【商家-发货超时】实施细则",
    patterns: ["【商家-发货超时】实施细则"],
    exclude: ["高频违规", "特殊行业", "钱币"]
  },
  {
    key: "stockout",
    label: "【商家-缺货/无货】实施细则",
    patterns: ["【商家-缺货/无货】实施细则", "【商家-缺货无货】实施细则"],
    exclude: []
  },
  {
    key: "track_timeout",
    label: "【商家-物流轨迹超时】实施细则",
    patterns: ["【商家-物流轨迹超时】实施细则"],
    exclude: []
  },
  {
    key: "track_abnormal",
    label: "【商家-物流轨迹异常】实施细则",
    patterns: ["【商家-物流轨迹异常】实施细则"],
    exclude: []
  },
  {
    key: "fraud_ship",
    label: "【商家-欺诈发货】实施细则",
    patterns: ["【商家-欺诈发货】实施细则"],
    exclude: []
  },
  {
    key: "penalty_index",
    label: "【商家-违规发货违规处理手段】实施细则",
    patterns: [
      "【商家-违规发货违规处理手段】实施细则",
      "违规发货违规处理手段"
    ],
    exclude: []
  }
];

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function matchesTarget(title, target) {
  const t = normalizeText(title);
  if (!target.patterns.some((p) => t.includes(p))) return false;
  if (target.exclude.some((e) => t.includes(e))) return false;
  return true;
}

async function fetchCatalogPage(page) {
  const url = new URL("/api/eschool/v2/library/article/list", BASE_URL);
  url.searchParams.set("node_id", String(ROOT_NODE_ID));
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(PAGE_SIZE));
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
      Referer: `${BASE_URL}/doudian/web/`,
      Origin: BASE_URL
    }
  });
  const payload = await response.json();
  if (payload?.code !== 0) {
    throw new Error(payload?.msg || `catalog code ${payload?.code}`);
  }
  return payload.data?.articles || [];
}

async function scanCatalog() {
  const hits = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const articles = await fetchCatalogPage(page);
    for (const a of articles) {
      const title = normalizeText(a.name || a.title || "");
      const id = String(a.article_id || a.id || "").trim();
      if (!id || !title) continue;
      for (const target of TARGETS) {
        if (matchesTarget(title, target)) {
          hits.push({
            key: target.key,
            slug: id,
            title,
            url: `${BASE_URL}/doudian/web/article/${id}`,
            source: "catalog"
          });
        }
      }
    }
    if (articles.length < PAGE_SIZE) break;
  }
  return hits;
}

async function scanRulesJson() {
  const rulesPath = path.join(repoRoot, "data", "douyin", "rules.json");
  const raw = await readFile(rulesPath, "utf8");
  const rules = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const hits = [];
  for (const rule of rules) {
    const title = normalizeText(rule.title || "");
    const url = rule.url || "";
    if (!url.includes("/article/")) continue;
    const slug = rule.id || url.split("/article/")[1]?.split(/[?#]/)[0];
    if (!slug) continue;
    for (const target of TARGETS) {
      if (matchesTarget(title, target)) {
        hits.push({
          key: target.key,
          slug,
          title,
          url: url.startsWith("http") ? url : `${BASE_URL}/doudian/web/article/${slug}`,
          source: "rules.json",
          contentLen: (rule.content || "").length
        });
      }
    }
  }
  return hits;
}

function pickBest(candidates) {
  if (!candidates.length) return null;
  const sourceRank = { "101706-embed": 0, "rules.json": 1, catalog: 2 };
  const sorted = [...candidates].sort((a, b) => {
    const rankDiff =
      (sourceRank[a.source] ?? 9) - (sourceRank[b.source] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    const contentDiff = (b.contentLen || 0) - (a.contentLen || 0);
    if (contentDiff !== 0) return contentDiff;
    return a.slug.localeCompare(b.slug);
  });
  return sorted[0];
}

async function extractFrom101706() {
  const u = new URL("/api/eschool/v2/library/article/detail", BASE_URL);
  u.searchParams.set("id", "101706");
  u.searchParams.set("graphId", String(GRAPH_ID));
  u.searchParams.set("need_content", "true");
  const response = await fetch(u.toString(), {
    headers: {
      Accept: "application/json",
      Referer: `${BASE_URL}/doudian/web/article/101706`,
      Origin: BASE_URL
    }
  });
  const payload = await response.json();
  const content = JSON.stringify(payload.data?.article_info?.content || "");
  const slugs = [...new Set([...content.matchAll(/article\/([a-zA-Z0-9]+)/g)].map((m) => m[1]))];
  const hits = [];
  for (const slug of slugs) {
    const detailUrl = new URL("/api/eschool/v2/library/article/detail", BASE_URL);
    detailUrl.searchParams.set("id", slug);
    detailUrl.searchParams.set("graphId", String(GRAPH_ID));
    detailUrl.searchParams.set("need_content", "false");
    const dr = await fetch(detailUrl, {
      headers: {
        Accept: "application/json",
        Referer: `${BASE_URL}/doudian/web/article/${slug}`,
        Origin: BASE_URL
      }
    });
    const dj = await dr.json();
    const title = normalizeText(dj.data?.article_info?.name || "");
    if (!title) continue;
    for (const target of TARGETS) {
      if (matchesTarget(title, target)) {
        hits.push({
          key: target.key,
          slug,
          title,
          url: `${BASE_URL}/doudian/web/article/${slug}`,
          source: "101706-embed"
        });
      }
    }
  }
  return hits;
}

const catalogHits = await scanCatalog();
const rulesHits = await scanRulesJson();
const embedHits = await extractFrom101706();
const allHits = [...embedHits, ...catalogHits, ...rulesHits];

const resolved = {};
for (const target of TARGETS) {
  const candidates = allHits.filter((h) => h.key === target.key);
  const best = pickBest(candidates);
  resolved[target.key] = best
    ? {
        key: target.key,
        label: target.label,
        slug: best.slug,
        ruleTitle: best.title,
        url: best.url,
        resolvedFrom: best.source,
        contentLen: best.contentLen || 0,
        candidateCount: candidates.length
      }
    : {
        key: target.key,
        label: target.label,
        slug: null,
        candidateCount: candidates.length
      };
}

const outPath = path.join(repoRoot, "data", "douyin", "penalty-detail-slugs.json");
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify({ updatedAt: new Date().toISOString(), resolved }, null, 2), "utf8");

console.log(JSON.stringify(resolved, null, 2));

const missing = Object.values(resolved).filter((r) => !r.slug);
if (missing.length) {
  console.error(`missing slugs: ${missing.map((m) => m.key).join(", ")}`);
  process.exit(1);
}
