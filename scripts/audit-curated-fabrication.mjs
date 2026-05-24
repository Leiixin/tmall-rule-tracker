import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchRuleDetailByRuleIdLite } from "../src/crawler/mtopFetchLite.js";
import {
  auditLiAgainstSource,
  parseLiItems,
  summarizeCardAudit,
  stripHtml
} from "../src/utils/curatedFabrication.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const DOCS = path.join(ROOT, "docs");

const CATEGORY_KEYS = ["shelf", "score", "ship", "penalty"];

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

function findRuleInRulesJson(rules, ruleId) {
  const id = String(ruleId || "");
  if (!id || !Array.isArray(rules)) {
    return null;
  }
  return (
    rules.find((r) => String(r.url || "").includes(`ruleId=${id}`)) || null
  );
}

async function loadSourceBodies(sources, rules, cache) {
  const byId = { ...cache.sources };
  let cacheDirty = false;

  for (const source of sources) {
    const sid = source.id;
    if (byId[sid]?.content && byId[sid].content.length > 100) {
      continue;
    }

    const fromRules = findRuleInRulesJson(rules, source.ruleId);
    if (fromRules?.content && fromRules.content.length > 100) {
      byId[sid] = {
        ruleId: source.ruleId,
        title: fromRules.title || source.ruleTitle || "",
        content: fromRules.content,
        fetchedAt: fromRules.crawledAt || new Date().toISOString(),
        origin: "rules.json"
      };
      cacheDirty = true;
      continue;
    }

    if (!source.ruleId) {
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(`[audit] MTOP fetch ruleId=${source.ruleId} (${source.label || sid})...`);
    try {
      const detail = await fetchRuleDetailByRuleIdLite(source.ruleId);
      if (detail?.content) {
        byId[sid] = {
          ruleId: detail.ruleId,
          title: detail.title,
          content: detail.content,
          fetchedAt: detail.crawledAt || new Date().toISOString(),
          origin: "mtop"
        };
        cacheDirty = true;
      } else {
        byId[sid] = {
          ruleId: source.ruleId,
          title: source.ruleTitle || "",
          content: "",
          fetchedAt: null,
          origin: "mtop_failed"
        };
        cacheDirty = true;
      }
    } catch (err) {
      byId[sid] = {
        ruleId: source.ruleId,
        title: source.ruleTitle || "",
        content: "",
        fetchedAt: null,
        origin: "mtop_error",
        error: err instanceof Error ? err.message : String(err)
      };
      cacheDirty = true;
    }
  }

  if (cacheDirty) {
    cache.updatedAt = new Date().toISOString();
    cache.sources = byId;
    await writeJson(path.join(DATA, "curated-source-cache.json"), cache);
  }

  return byId;
}

function collectCards(curatedCards) {
  const cards = [];
  for (const cat of CATEGORY_KEYS) {
    const section = curatedCards[cat];
    if (!section?.cards) {
      continue;
    }
    for (const card of section.cards) {
      cards.push({
        category: cat,
        cardId: card.cardId,
        title: card.title,
        sourceId: card.sourceId,
        link: card.link,
        body: card.body
      });
    }
  }
  return cards;
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push("# Curated 卡片规则溯源检测报告");
  lines.push("");
  lines.push(`生成时间：${report.generatedAt}`);
  lines.push("");
  lines.push("## 总览");
  lines.push("");
  lines.push(`| 指标 | 数量 |`);
  lines.push(`|------|------|`);
  lines.push(`| 卡片 | ${report.summary.cards} |`);
  lines.push(`| 要点条数 (li) | ${report.summary.liCount} |`);
  lines.push(`| supported | ${report.summary.supported} |`);
  lines.push(`| simplified | ${report.summary.simplified} |`);
  lines.push(`| fabricated | ${report.summary.fabricated} |`);
  lines.push(`| source_unavailable (li) | ${report.summary.sourceUnavailableLi} |`);
  lines.push(`| 卡片结论 fabricated | ${report.summary.cardsFabricated} |`);
  lines.push(`| 卡片结论 simplified | ${report.summary.cardsSimplified} |`);
  lines.push(`| 卡片结论 supported | ${report.summary.cardsSupported} |`);
  lines.push(`| 来源 MTOP 失败 | ${report.summary.sourcesFailed.join(", ") || "无"} |`);
  lines.push("");

  lines.push("## 按分类");
  lines.push("");
  for (const cat of CATEGORY_KEYS) {
    const rows = report.cards.filter((c) => c.category === cat);
    if (!rows.length) {
      continue;
    }
    lines.push(`### ${cat}`);
    lines.push("");
    lines.push("| cardId | 标题 | 卡片结论 | 问题要点 |");
    lines.push("|--------|------|----------|----------|");
    for (const c of rows) {
      const issues = c.li
        .filter((x) => x.verdict === "fabricated" || x.verdict === "simplified")
        .map((x) => `${x.verdict}: ${x.text.slice(0, 40)}… (${x.reason})`)
        .join("<br>") || "—";
      lines.push(`| ${c.cardId} | ${c.title} | **${c.cardVerdict}** | ${issues} |`);
    }
    lines.push("");
  }

  const fab = report.cards.filter((c) => c.cardVerdict === "fabricated");
  if (fab.length) {
    lines.push("## 杜撰 (fabricated)");
    lines.push("");
    for (const c of fab) {
      lines.push(`### ${c.cardId} — ${c.title}`);
      lines.push(`- 来源：\`${c.sourceId}\` (${c.sourceTitle || "?"})`);
      for (const x of c.li.filter((i) => i.verdict === "fabricated")) {
        lines.push(`- **${x.text}** — ${x.reason}`);
      }
      lines.push("");
    }
  }

  const simp = report.cards.filter(
    (c) => c.cardVerdict === "simplified" && c.cardVerdict !== "fabricated"
  );
  if (simp.length) {
    lines.push("## 简化/待核对 (simplified)");
    lines.push("");
    for (const c of simp) {
      const items = c.li.filter((i) => i.verdict === "simplified");
      if (!items.length) {
        continue;
      }
      lines.push(`### ${c.cardId} — ${c.title}`);
      for (const x of items) {
        lines.push(`- ${x.text} — ${x.reason}`);
      }
      lines.push("");
    }
  }

  const failed = report.sources.filter((s) => !s.contentLength);
  if (failed.length) {
    lines.push("## 来源不可用");
    lines.push("");
    for (const s of failed) {
      lines.push(`- \`${s.id}\` ruleId=${s.ruleId} — ${s.origin} ${s.error || ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const curatedCards = await readJson(path.join(DATA, "curated-cards.json"), {});
  const curatedSources = await readJson(path.join(DATA, "curated-sources.json"), {
    sources: []
  });
  const rulesPayload = await readJson(path.join(DATA, "rules.json"), []);
  const rules = Array.isArray(rulesPayload)
    ? rulesPayload
    : rulesPayload.rules || [];

  let cache = await readJson(path.join(DATA, "curated-source-cache.json"), {
    version: 1,
    sources: {}
  });

  const sourceBodies = await loadSourceBodies(
    curatedSources.sources || [],
    rules,
    cache
  );
  cache = await readJson(path.join(DATA, "curated-source-cache.json"), cache);

  const cards = collectCards(curatedCards);
  const sourceMeta = (curatedSources.sources || []).map((s) => ({
    id: s.id,
    ruleId: s.ruleId,
    label: s.label,
    contentLength: (sourceBodies[s.id]?.content || "").length,
    origin: sourceBodies[s.id]?.origin || "missing",
    error: sourceBodies[s.id]?.error || null
  }));

  const cardReports = [];
  let liCount = 0;
  let supported = 0;
  let simplified = 0;
  let fabricated = 0;
  let sourceUnavailableLi = 0;

  for (const card of cards) {
    const src = sourceBodies[card.sourceId];
    const content = src?.content || "";
    const lis = parseLiItems(card.body);
    if (!lis.length) {
      lis.push(stripHtml(card.body));
    }

    const liResults = lis.map((text) => {
      const { verdict, reason } = auditLiAgainstSource(text, content);
      liCount += 1;
      if (verdict === "supported") {
        supported += 1;
      } else if (verdict === "simplified") {
        simplified += 1;
      } else if (verdict === "fabricated") {
        fabricated += 1;
      } else if (verdict === "source_unavailable") {
        sourceUnavailableLi += 1;
      }
      return { text, verdict, reason };
    });

    const summary = summarizeCardAudit(liResults);
    cardReports.push({
      category: card.category,
      cardId: card.cardId,
      title: card.title,
      sourceId: card.sourceId,
      sourceTitle: src?.title || "",
      sourceOrigin: src?.origin || "missing",
      cardVerdict: !content ? "source_unavailable" : summary.cardVerdict,
      li: liResults
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      cards: cards.length,
      liCount,
      supported,
      simplified,
      fabricated,
      sourceUnavailableLi,
      cardsFabricated: cardReports.filter((c) => c.cardVerdict === "fabricated")
        .length,
      cardsSimplified: cardReports.filter((c) => c.cardVerdict === "simplified")
        .length,
      cardsSupported: cardReports.filter((c) => c.cardVerdict === "supported")
        .length,
      sourcesFailed: sourceMeta
        .filter((s) => !s.contentLength)
        .map((s) => s.id)
    },
    sources: sourceMeta,
    cards: cardReports
  };

  await mkdir(DOCS, { recursive: true });
  const jsonPath = path.join(DOCS, "curated-fabrication-report.json");
  await writeJson(jsonPath, report);

  const md = buildMarkdownReport(report);
  const mdPath = path.join(DOCS, "curated-fabrication-report.md");
  await writeFile(mdPath, md, "utf8");

  // eslint-disable-next-line no-console
  console.log("\n" + md);
  // eslint-disable-next-line no-console
  console.log(`\n[audit] Wrote ${jsonPath} and ${mdPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[audit] failed:", err);
  process.exit(1);
});
