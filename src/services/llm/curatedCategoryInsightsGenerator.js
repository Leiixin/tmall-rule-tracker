import dayjs from "dayjs";

import { chatJsonRaw, isLlmEnabled } from "./client.js";
import { buildRuleDetailUrl } from "../../utils/ruleDetailUrl.js";
import {
  CURATED_INSIGHTS_PROMPT_VERSION,
  buildCategoryInsightsSystemPrompt,
  buildCategoryInsightsUserPrompt
} from "./curatedCategoryInsightsPrompts.js";

const VALID_CHANGE_TYPES = new Set(["new", "modify", "remove"]);
const VALID_IMPACT_LEVELS = new Set(["high", "medium", "low"]);
const VALID_STRATEGY_LEVELS = new Set(["action", "high", "medium", "low"]);

function formatDate(iso) {
  const t = dayjs(iso);
  return t.isValid() ? t.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
}

function normalizeChanges(raw, defaultDate, defaultLink) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => {
      const title = String(item?.title || "").trim();
      const detail = String(item?.detail || "").trim();
      if (!title || !detail) {
        return null;
      }
      const type = VALID_CHANGE_TYPES.has(item?.type) ? item.type : "modify";
      return {
        type,
        title: title.slice(0, 80),
        detail: detail.slice(0, 500),
        date: String(item?.date || defaultDate).slice(0, 10),
        link: String(item?.link || defaultLink || "").slice(0, 500)
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeAnalysisItems(raw, validLevels, defaultLevel, maxItems = 6) {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => {
      const title = String(item?.title || "").trim();
      const desc = String(item?.desc || "").trim();
      if (!title || !desc) {
        return null;
      }
      const level = validLevels.has(item?.level) ? item.level : defaultLevel;
      return {
        level,
        title: title.slice(0, 80),
        desc: desc.slice(0, 400)
      };
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeCategoryInsights(parsed, { source, detail, platformModifiedAt }) {
  const dateDefault = formatDate(platformModifiedAt || detail?.publishedAt);
  const link =
    source?.url ||
    (source?.ruleId ? buildRuleDetailUrl(source.ruleId, source.cId) : "");

  const changes = normalizeChanges(parsed?.changes, dateDefault, link);
  const impacts = normalizeAnalysisItems(
    parsed?.impacts,
    VALID_IMPACT_LEVELS,
    "medium"
  );
  const strategies = normalizeAnalysisItems(
    parsed?.strategies,
    VALID_STRATEGY_LEVELS,
    "action"
  );

  if (changes.length < 3) {
    throw new Error("LLM returned fewer than 3 change items");
  }
  if (impacts.length < 3 || strategies.length < 3) {
    throw new Error("LLM returned insufficient impacts or strategies (need 3+ each)");
  }

  return {
    pinned: false,
    sourceId: source.id,
    ruleTitle: detail?.title || source.ruleTitle || "",
    panelSubtitle: String(parsed?.panelSubtitle || "规则更新解读").slice(0, 80),
    generatedAt: new Date().toISOString(),
    link,
    changes,
    impacts,
    strategies
  };
}

export async function generateCategoryInsights({
  category,
  detail,
  source,
  previousContent,
  platform = "tmall"
}) {
  if (!isLlmEnabled()) {
    throw new Error("LLM is disabled");
  }

  const system = buildCategoryInsightsSystemPrompt(category, platform);
  const user = buildCategoryInsightsUserPrompt({
    category,
    ruleTitle: detail.title,
    platformModifiedAt: detail.publishedAt,
    ruleUrl: source.url,
    previousContent,
    newContent: detail.content
  });

  const parsed = await chatJsonRaw({ system, user });
  const block = normalizeCategoryInsights(parsed, {
    source,
    detail,
    platformModifiedAt: detail.publishedAt
  });

  return {
    block,
    promptVersion: CURATED_INSIGHTS_PROMPT_VERSION,
    generatedAt: block.generatedAt
  };
}
