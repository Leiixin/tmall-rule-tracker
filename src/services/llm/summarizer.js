import { createHash } from "node:crypto";

import { saveRules } from "../storage.js";
import { getLastWeekRange } from "../weeklyReport.js";
import { isDouyinWeeklyRule } from "../../utils/weeklyEligibility.js";
import {
  PROMPT_VERSION,
  buildRuleSummaryUserPrompt,
  getRuleSummarySystemPrompt
} from "./prompts.js";
import { chatJson, getLlmConfig, isLlmEnabled } from "./client.js";
import { summaryNeedsQualityRetry } from "../../utils/summaryQuality.js";

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
  const hasHighlights =
    existing?.highlightsStructured &&
    typeof existing.highlightsStructured === "object" &&
    Object.keys(existing.highlightsStructured).length > 0;
  const hasImpacts =
    existing?.impactsStructured &&
    typeof existing.impactsStructured === "object" &&
    Object.keys(existing.impactsStructured).length > 0;
  const hasActions =
    existing?.actionsStructured &&
    typeof existing.actionsStructured === "object" &&
    Object.keys(existing.actionsStructured).length > 0;
  const hasSummary =
    hasHighlights ||
    hasImpacts ||
    hasActions ||
    (Array.isArray(existing?.highlights) && existing.highlights.length > 0) ||
    (Array.isArray(existing?.impacts) && existing.impacts.length > 0) ||
    (Array.isArray(existing?.actions) && existing.actions.length > 0) ||
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

export async function summarizeRule(rule, options = {}) {
  const platform = options.platform || "tmall";
  const maxChars = Number(process.env.LLM_CONTENT_MAX_CHARS || 6000);
  const system = getRuleSummarySystemPrompt(platform);
  const user = buildRuleSummaryUserPrompt(rule, maxChars, platform);
  let parsed = await chatJson({
    system,
    user,
    temperature: 0.2
  });

  if (summaryNeedsQualityRetry(rule, parsed)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[llm] retry (tighter extraction): ${rule.title?.slice(0, 40) || "rule"}`
    );
    try {
      const retryUser = `${user}\n\n【补充要求】上次摘要遗漏了原文中的处罚依据规则名称、5天未寄出或30元赔付红包等要点，请严格按原文分条补全「核心变化」与「不利」。`;
      parsed = await chatJson({
        system,
        user: retryUser,
        temperature: 0.1
      });
      if (summaryNeedsQualityRetry(rule, parsed)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[llm] retry still incomplete: ${rule.title?.slice(0, 40) || "rule"}`
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[llm] retry failed, keeping first pass: ${rule.title?.slice(0, 40) || "rule"}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const { model } = getLlmConfig();
  return {
    ...parsed,
    contentHash: contentHash(rule),
    model,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString()
  };
}

function prioritizeRules(rules, previousRules, options = {}) {
  const { weeklyScope } = options;
  const prevMap = new Map(previousRules.map((r) => [ruleKey(r), r]));
  const range = getLastWeekRange();
  const max =
    weeklyScope === "douyin"
      ? Number(process.env.LLM_MAX_DOUYIN_WEEKLY || process.env.LLM_MAX_RULES_PER_RUN || 30)
      : Number(process.env.LLM_MAX_RULES_PER_RUN || 20);

  let candidates = rules.filter((rule) =>
    needsAiSummary(rule, prevMap.get(ruleKey(rule)))
  );

  if (weeklyScope === "douyin") {
    candidates = candidates.filter((rule) => isDouyinWeeklyRule(rule, range));
  }

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
  const {
    previousRules = [],
    persist = true,
    platform,
    weeklyScope
  } = options;
  const llmPlatform =
    platform || (weeklyScope === "douyin" ? "douyin" : weeklyScope === "intl" ? "intl" : "tmall");

  if (!isLlmEnabled()) {
    return { rules, summarized: 0, skipped: 0, errors: 0, disabled: true };
  }

  const { candidates, skipped } = prioritizeRules(rules, previousRules, {
    weeklyScope
  });
  const delayMs = Number(process.env.LLM_REQUEST_DELAY_MS || 500);
  let summarized = 0;
  let errors = 0;

  const byKey = new Map(rules.map((r) => [ruleKey(r), r]));

  for (const rule of candidates) {
    const key = ruleKey(rule);
    try {
      const aiSummary = await summarizeRule(rule, { platform: llmPlatform });
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
