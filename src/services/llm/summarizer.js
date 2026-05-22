import { createHash } from "node:crypto";

import { saveRules } from "../storage.js";
import { getLastWeekRange } from "../weeklyReport.js";
import {
  PROMPT_VERSION,
  RULE_SUMMARY_SYSTEM_PROMPT,
  buildRuleSummaryUserPrompt
} from "./prompts.js";
import { chatJson, getLlmConfig, isLlmEnabled } from "./client.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function contentHash(rule) {
  const text = `${rule.title || ""}\n${rule.content || ""}`;
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function needsAiSummary(rule, previousRule = null) {
  if (!rule?.content || String(rule.content).length < 80) {
    return false;
  }
  const hash = contentHash(rule);
  const existing = rule.aiSummary;
  const hasSummary =
    (Array.isArray(existing?.highlights) && existing.highlights.length > 0) ||
    Boolean(existing?.highlight);
  if (!hasSummary) {
    return true;
  }
  if (existing.promptVersion !== PROMPT_VERSION) {
    return true;
  }
  if (existing.contentHash !== hash) {
    return true;
  }
  if (previousRule && contentHash(previousRule) !== hash) {
    return true;
  }
  return false;
}

function ruleKey(rule) {
  return rule.url || `${rule.title}|${rule.publishedAt}`;
}

export async function summarizeRule(rule) {
  const maxChars = Number(process.env.LLM_CONTENT_MAX_CHARS || 6000);
  const user = buildRuleSummaryUserPrompt(rule, maxChars);
  const parsed = await chatJson({
    system: RULE_SUMMARY_SYSTEM_PROMPT,
    user
  });

  const { model } = getLlmConfig();
  return {
    ...parsed,
    contentHash: contentHash(rule),
    model,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString()
  };
}

function prioritizeRules(rules, previousRules) {
  const prevMap = new Map(previousRules.map((r) => [ruleKey(r), r]));
  const range = getLastWeekRange();
  const max = Number(process.env.LLM_MAX_RULES_PER_RUN || 20);

  const candidates = rules.filter((rule) => needsAiSummary(rule, prevMap.get(ruleKey(rule))));

  const weekStart = range.start.valueOf();
  const weekEnd = range.end.valueOf();

  candidates.sort((a, b) => {
    const aTime = new Date(a.publishedAt || a.lastSeenAt || 0).getTime();
    const bTime = new Date(b.publishedAt || b.lastSeenAt || 0).getTime();
    const aInWeek = aTime >= weekStart && aTime <= weekEnd;
    const bInWeek = bTime >= weekStart && bTime <= weekEnd;
    if (aInWeek !== bInWeek) {
      return aInWeek ? -1 : 1;
    }
    return (
      new Date(b.publishedAt || b.lastSeenAt || 0) -
      new Date(a.publishedAt || a.lastSeenAt || 0)
    );
  });

  const picked = new Set(candidates.slice(0, max).map(ruleKey));
  return { candidates: candidates.filter((r) => picked.has(ruleKey(r))), skipped: candidates.length - picked.size };
}

/**
 * 为需要更新的规则调用 DeepSeek 生成 aiSummary，并写回 rules 数组（可选 saveRules）
 */
export async function enrichRulesWithAiSummary(rules, options = {}) {
  const { previousRules = [], persist = true } = options;

  if (!isLlmEnabled()) {
    return { rules, summarized: 0, skipped: 0, errors: 0, disabled: true };
  }

  const { candidates, skipped } = prioritizeRules(rules, previousRules);
  const delayMs = Number(process.env.LLM_REQUEST_DELAY_MS || 500);
  let summarized = 0;
  let errors = 0;

  const byKey = new Map(rules.map((r) => [ruleKey(r), r]));

  for (const rule of candidates) {
    const key = ruleKey(rule);
    try {
      const aiSummary = await summarizeRule(rule);
      const target = byKey.get(key);
      if (target) {
        target.aiSummary = aiSummary;
      }
      summarized += 1;
      // eslint-disable-next-line no-console
      console.log(`[llm] summarized: ${rule.title?.slice(0, 40) || key}`);
    } catch (err) {
      errors += 1;
      // eslint-disable-next-line no-console
      console.warn(
        `[llm] failed: ${rule.title?.slice(0, 40) || key}`,
        err instanceof Error ? err.message : err
      );
    }
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const merged = [...byKey.values()];
  if (persist) {
    await saveRules(merged);
  }

  return { rules: merged, summarized, skipped, errors, disabled: false };
}
