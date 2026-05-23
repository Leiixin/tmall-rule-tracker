import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

import { buildRuleDetailUrl, normalizeRuleDetailUrl } from "../src/utils/ruleDetailUrl.js";

const CATEGORY_KEYS = ["shelf", "score", "ship", "penalty"];

function parseRuleIdFromUrl(url) {
  const normalized = normalizeRuleDetailUrl(url || "");
  if (!normalized) {
    return { ruleId: "", cId: "" };
  }
  try {
    const u = new URL(normalized);
    let ruleId = u.searchParams.get("ruleId") || "";
    let cId = u.searchParams.get("cId") || "";
    if (!ruleId && u.hash) {
      const hashBody = u.hash.replace(/^#\/?/, "");
      const qIdx = hashBody.indexOf("?");
      const hp = new URLSearchParams(qIdx >= 0 ? hashBody.slice(qIdx + 1) : "");
      ruleId = hp.get("ruleId") || ruleId;
      cId = hp.get("cId") || cId;
    }
    return { ruleId, cId };
  } catch {
    return { ruleId: "", cId: "" };
  }
}

function loadRulesDataFromIndex(html) {
  const start = html.indexOf("const RULES_DATA = ");
  const end = html.indexOf("\n};\n\nconst TIMELINE_DATA");
  if (start < 0 || end < 0) {
    throw new Error("RULES_DATA block not found in index.html");
  }
  const expr = html.slice(start + "const RULES_DATA = ".length, end + 2);
  return vm.runInNewContext(`(${expr})`, {});
}

async function main() {
  const root = process.cwd();
  const indexPath = path.join(root, "index.html");
  const html = await readFile(indexPath, "utf8");
  const rulesData = loadRulesDataFromIndex(html);

  const sourceMap = new Map();

  for (const category of CATEGORY_KEYS) {
    const section = rulesData[category];
    if (!section?.cards) {
      continue;
    }
    section.cards = section.cards.map((card, index) => {
      const cardId = `${category}:${index}`;
      const link = card.link || "";
      const { ruleId, cId } = parseRuleIdFromUrl(link);
      const sourceKey = ruleId || `no-id-${category}-${index}`;
      const sourceId = ruleId ? `rule-${ruleId}` : `local-${category}-${index}`;

      if (!sourceMap.has(sourceId)) {
        sourceMap.set(sourceId, {
          id: sourceId,
          ruleId: ruleId || "",
          cId: cId || "",
          url: link || (ruleId ? buildRuleDetailUrl(ruleId, cId) : ""),
          label: card.title || section.title || category,
          categories: [],
          cardIds: []
        });
      }

      const entry = sourceMap.get(sourceId);
      if (!entry.categories.includes(category)) {
        entry.categories.push(category);
      }
      entry.cardIds.push(cardId);
      if (card.title && entry.label === section.title) {
        entry.label = card.title;
      }

      return { ...card, sourceId, cardId };
    });
  }

  const curatedCards = {
    version: 1,
    updatedAt: new Date().toISOString(),
    autoPublishVersion: 0,
    ...rulesData
  };

  const curatedSources = {
    version: 1,
    updatedAt: new Date().toISOString(),
    repoEditUrl:
      "https://github.com/Leiixin/tmall-rule-tracker/edit/main/data/curated-sources.json",
    sources: [...sourceMap.values()]
  };

  const dataDir = path.join(root, "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    path.join(dataDir, "curated-cards.json"),
    `\uFEFF${JSON.stringify(curatedCards, null, 2)}`,
    "utf8"
  );
  await writeFile(
    path.join(dataDir, "curated-sources.json"),
    `\uFEFF${JSON.stringify(curatedSources, null, 2)}`,
    "utf8"
  );

  const publicDataDir = path.join(root, "public", "data");
  await mkdir(publicDataDir, { recursive: true });
  await writeFile(
    path.join(publicDataDir, "curated-cards.json"),
    `\uFEFF${JSON.stringify(curatedCards, null, 2)}`,
    "utf8"
  );
  await writeFile(
    path.join(publicDataDir, "curated-sources.json"),
    `\uFEFF${JSON.stringify(curatedSources, null, 2)}`,
    "utf8"
  );

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        categories: CATEGORY_KEYS.length,
        cards: CATEGORY_KEYS.reduce(
          (n, k) => n + (rulesData[k]?.cards?.length || 0),
          0
        ),
        sources: curatedSources.sources.length
      },
      null,
      2
    )
  );
}

await main();
