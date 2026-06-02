/**
 * 一次性拉取抖音规则正文（无 dayjs 等依赖）
 * 用法: node scripts/fetch-douyin-rule-text-once.mjs 101706
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const slug = process.argv[2] || "101706";
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://school.jinritemai.com";
const GRAPH_ID = 312;

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function extractDouyinDeltaText(content) {
  if (!content) return "";
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const chunks = [];
    const walkOps = (ops) => {
      if (!Array.isArray(ops)) return;
      for (const op of ops) {
        if (typeof op?.insert === "string") chunks.push(op.insert);
      }
    };
    const deltas = parsed?.deltas || parsed;
    if (Array.isArray(deltas)) {
      for (const block of deltas) walkOps(block?.ops);
    } else if (deltas && typeof deltas === "object") {
      for (const key of Object.keys(deltas)) walkOps(deltas[key]?.ops);
    }
    return normalizeText(chunks.join(""));
  } catch {
    return normalizeText(String(content));
  }
}

async function fetchDetail(id) {
  const url = new URL("/api/eschool/v2/library/article/detail", BASE_URL);
  url.searchParams.set("id", id);
  url.searchParams.set("graphId", String(GRAPH_ID));
  url.searchParams.set("need_content", "true");
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: `${BASE_URL}/doudian/web/article/${id}`,
      Origin: BASE_URL
    }
  });
  const text = await response.text();
  const payload = JSON.parse(text);
  if (payload?.code !== 0) {
    throw new Error(payload?.msg || `code ${payload?.code}`);
  }
  const info = payload.data?.article_info;
  const content = extractDouyinDeltaText(info?.content);
  return {
    title: normalizeText(info?.name || ""),
    content,
    publishedAt: info?.update_at
      ? new Date(info.update_at * 1000).toISOString()
      : new Date().toISOString()
  };
}

const detail = await fetchDetail(slug);
if (!detail.content) {
  console.error("empty content");
  process.exit(1);
}

for (const base of [
  path.join(repoRoot, "data", "douyin", "rule-text"),
  path.join(repoRoot, "public", "data", "douyin", "rule-text")
]) {
  await mkdir(base, { recursive: true });
  await writeFile(path.join(base, `rule-${slug}.txt`), detail.content, "utf8");
}

console.log(
  JSON.stringify(
    { ok: true, slug, title: detail.title, contentLen: detail.content.length },
    null,
    2
  )
);
