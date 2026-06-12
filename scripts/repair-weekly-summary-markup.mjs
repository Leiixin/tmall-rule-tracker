import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeWeeklySpanMarkup } from "../src/services/llm/client.js";
import {
  flattenActionsStructured,
  flattenHighlightsStructured,
  flattenImpactsStructured
} from "../src/services/llm/prompts.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function looksTruncated(text) {
  const t = String(text || "");
  return (
    /以<$/.test(t) ||
    /<\/sp(?:an)?$/i.test(t) ||
    /<span[^>]*$/i.test(t) ||
    /<[^>]*$/.test(t)
  );
}

function repairPoint(text) {
  return normalizeWeeklySpanMarkup(text);
}

function repairStructured(structured) {
  if (!structured || typeof structured !== "object") {
    return { structured, truncated: false };
  }
  let truncated = false;
  const next = {};
  for (const [key, items] of Object.entries(structured)) {
    if (!Array.isArray(items)) {
      continue;
    }
    next[key] = items.map((point) => {
      const raw = String(point || "");
      if (looksTruncated(raw)) {
        truncated = true;
      }
      return repairPoint(raw);
    });
  }
  return { structured: next, truncated };
}

function repairFlat(lines) {
  if (!Array.isArray(lines)) {
    return lines;
  }
  return lines.map((line) => repairPoint(line));
}

async function repairFile(relPath) {
  const filePath = path.join(repoRoot, relPath);
  const raw = await readFile(filePath, "utf8");
  const rules = JSON.parse(raw.replace(/^\uFEFF/, ""));
  let pointsFixed = 0;
  let rulesTruncated = 0;

  for (const rule of rules) {
    const ai = rule.aiSummary;
    if (!ai) {
      continue;
    }

    let ruleTruncated = false;

    if (ai.highlightsStructured) {
      const { structured, truncated } = repairStructured(ai.highlightsStructured);
      ai.highlightsStructured = structured;
      ruleTruncated ||= truncated;
    }
    if (ai.impactsStructured) {
      const { structured, truncated } = repairStructured(ai.impactsStructured);
      ai.impactsStructured = structured;
      ruleTruncated ||= truncated;
    }
    if (ai.actionsStructured) {
      const { structured, truncated } = repairStructured(ai.actionsStructured);
      ai.actionsStructured = structured;
      ruleTruncated ||= truncated;
    }

    if (ai.highlightsStructured) {
      ai.highlights = flattenHighlightsStructured(ai.highlightsStructured);
    } else if (ai.highlights) {
      ai.highlights = repairFlat(ai.highlights);
    }
    if (ai.impactsStructured) {
      ai.impacts = flattenImpactsStructured(ai.impactsStructured);
    } else if (ai.impacts) {
      ai.impacts = repairFlat(ai.impacts);
    }
    if (ai.actionsStructured) {
      ai.actions = flattenActionsStructured(ai.actionsStructured);
    } else if (ai.actions) {
      ai.actions = repairFlat(ai.actions);
    }
    if (ai.highlight) {
      ai.highlight = repairPoint(ai.highlight);
    }

    pointsFixed += 1;
    if (ruleTruncated) {
      rulesTruncated += 1;
      delete ai.contentHash;
    }
  }

  await writeFile(filePath, `\uFEFF${JSON.stringify(rules, null, 2)}`, "utf8");
  return { filePath, rules: rules.length, pointsFixed, rulesTruncated };
}

const targets = [
  "data/rules.json",
  "public/data/rules.json",
  "data/douyin/rules.json",
  "public/data/douyin/rules.json"
];
const results = [];
for (const rel of targets) {
  results.push(await repairFile(rel));
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
