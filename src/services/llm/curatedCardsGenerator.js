import { chatJsonRaw, isLlmEnabled } from "./client.js";
import {
  CURATED_CARDS_PROMPT_VERSION,
  buildCuratedCardsSystemPrompt,
  buildCuratedCardsUserPrompt
} from "./curatedCardsPrompts.js";
import { buildRuleDetailUrl } from "../../utils/ruleDetailUrl.js";
import dayjs from "dayjs";

const VALID_SEVERITY = new Set(["critical", "warning", "info", "normal"]);

function formatCardDate(isoOrDate) {
  const t = dayjs(isoOrDate);
  return t.isValid() ? t.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
}

export function normalizeCuratedCards(parsed, { source, platformModifiedAt }) {
  const raw = Array.isArray(parsed?.cards) ? parsed.cards : [];
  const dateDefault = formatCardDate(platformModifiedAt);
  const link =
    source?.url ||
    (source?.ruleId
      ? buildRuleDetailUrl(source.ruleId, source.cId)
      : "");

  const cards = raw
    .map((card, index) => {
      const title = String(card?.title || "").trim();
      const body = String(card?.body || "").trim();
      if (!title || !body) {
        return null;
      }
      const severity = VALID_SEVERITY.has(card.severity)
        ? card.severity
        : "warning";
      return {
        cardId: `${source.categories?.[0] || "gen"}:llm-${Date.now()}-${index}`,
        sourceId: source.id,
        title: title.slice(0, 80),
        severity,
        severityText: String(card.severityText || "要点").slice(0, 12),
        date: String(card.date || dateDefault).slice(0, 10),
        tags: Array.isArray(card.tags)
          ? card.tags.map((t) => String(t).slice(0, 20)).slice(0, 4)
          : [],
        link,
        body: body.slice(0, 4000)
      };
    })
    .filter(Boolean);

  if (cards.length < 3) {
    throw new Error("LLM returned fewer than 3 curated cards");
  }
  return cards.slice(0, 8);
}

export async function generateCuratedCardsForCategory({
  category,
  detail,
  source
}) {
  if (!isLlmEnabled()) {
    throw new Error("LLM is disabled");
  }

  const system = buildCuratedCardsSystemPrompt(category);
  const user = buildCuratedCardsUserPrompt({
    category,
    ruleTitle: detail.title,
    platformModifiedAt: detail.publishedAt,
    content: detail.content
  });

  const parsed = await chatJsonRaw({ system, user });
  const cards = normalizeCuratedCards(parsed, {
    source: { ...source, categories: [category] },
    platformModifiedAt: detail.publishedAt
  });

  return {
    cards,
    promptVersion: CURATED_CARDS_PROMPT_VERSION,
    generatedAt: new Date().toISOString()
  };
}
