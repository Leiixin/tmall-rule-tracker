import { chatJsonRaw, isLlmEnabled } from "./client.js";
import {
  CURATED_CARDS_PROMPT_VERSION,
  buildCuratedCardsSystemPrompt,
  buildCuratedCardsUserPrompt,
  isDouyinPenaltyImplementationSource
} from "./curatedCardsPrompts.js";
import { buildRuleDetailUrl } from "../../utils/ruleDetailUrl.js";
import dayjs from "dayjs";

const VALID_SEVERITY = new Set(["critical", "warning", "info", "normal"]);

const REFERENCE_BODY_RE =
  /来源\s*[：:]|参见|详见|违规处理细则参见|参考【|参考《|细则参见/;

function formatCardDate(isoOrDate) {
  const t = dayjs(isoOrDate);
  return t.isValid() ? t.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
}

export function resolveGenerationLimits({ source, category, platform }) {
  if (isDouyinPenaltyImplementationSource(source, category, platform)) {
    return { minCards: 1, maxCards: 1, strictPenalty: true };
  }
  return { minCards: 3, maxCards: 8, strictPenalty: false };
}

export function sanitizeCuratedCardBody(body) {
  let text = String(body || "").trim();
  if (!text) {
    return "";
  }

  text = text.replace(/<li[^>]*>[\s\S]*?<\/li>/gi, (li) => {
    const plain = li.replace(/<[^>]+>/g, "");
    if (REFERENCE_BODY_RE.test(plain)) {
      return "";
    }
    return li;
  });

  text = text.replace(REFERENCE_BODY_RE, "");
  return text.trim();
}

export function validatePenaltyCardBody(body, { strictDouyin = false } = {}) {
  const html = String(body || "");
  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const hasRecognition = /认定|定义|判定|违规|情形|揽收|发运/.test(plain);
  const hasPenalty = /扣罚|赔付|实付|违约金|%/.test(plain);
  if (!hasRecognition) {
    throw new Error("penalty card missing recognition/definition content");
  }
  if (!hasPenalty) {
    throw new Error("penalty card missing order penalty standards");
  }
  if (REFERENCE_BODY_RE.test(plain)) {
    throw new Error("penalty card must not reference other rules in body");
  }

  if (strictDouyin) {
    if (!/认定①/.test(plain)) {
      throw new Error("douyin penalty card must include numbered 认定①");
    }
    const lis = html.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
    const penaltyLis = lis.filter((li) => {
      const liPlain = li.replace(/<[^>]+>/g, " ");
      if (/认定[：:①②③④⑤⑥⑦⑧⑨]/.test(liPlain)) {
        return false;
      }
      return /扣罚|赔付|实付|违约金|%/.test(liPlain);
    });
    if (penaltyLis.length < 2) {
      throw new Error(
        "douyin penalty card must have at least 2 separate penalty tier li items"
      );
    }
  }
}

export function validateDouyinPenaltyCardTitle(title) {
  const t = String(title || "").trim();
  if (/[：:]/.test(t)) {
    throw new Error("douyin penalty card title must not contain colon suffix");
  }
  if (t.length > 12) {
    throw new Error("douyin penalty card title too long");
  }
}

export function normalizeCuratedCards(
  parsed,
  { source, platformModifiedAt, category, platform, limits }
) {
  const { minCards, maxCards, strictPenalty } =
    limits || resolveGenerationLimits({ source, category, platform });
  const raw = Array.isArray(parsed?.cards) ? parsed.cards : [];
  const dateDefault = formatCardDate(platformModifiedAt);
  const link =
    source?.url ||
    (source?.ruleId ? buildRuleDetailUrl(source.ruleId, source.cId) : "");

  const cards = raw
    .map((card, index) => {
      const title = String(card?.title || "").trim();
      let body = sanitizeCuratedCardBody(card?.body);
      if (!title || !body) {
        return null;
      }
      if (strictPenalty) {
        validateDouyinPenaltyCardTitle(title);
        validatePenaltyCardBody(body, { strictDouyin: true });
      }
      const severity = VALID_SEVERITY.has(card.severity)
        ? card.severity
        : "warning";
      return {
        cardId: `${category || source.categories?.[0] || "gen"}:llm-${Date.now()}-${index}`,
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

  if (cards.length < minCards) {
    throw new Error(
      `LLM returned fewer than ${minCards} curated cards (got ${cards.length})`
    );
  }
  return cards.slice(0, maxCards);
}

export async function generateCuratedCardsForCategory({
  category,
  detail,
  source,
  platform = "tmall"
}) {
  if (!isLlmEnabled()) {
    throw new Error("LLM is disabled");
  }

  const limits = resolveGenerationLimits({ source, category, platform });
  const system = buildCuratedCardsSystemPrompt(category, platform, {
    source,
    cardCount: limits.maxCards === 1 ? "1" : undefined
  });
  const user = buildCuratedCardsUserPrompt({
    category,
    ruleTitle: detail.title,
    platformModifiedAt: detail.publishedAt,
    content: detail.content,
    source,
    platform
  });

  const parsed = await chatJsonRaw({ system, user });
  const cards = normalizeCuratedCards(parsed, {
    source: { ...source, categories: [category] },
    platformModifiedAt: detail.publishedAt,
    category,
    platform,
    limits
  });

  return {
    cards,
    promptVersion: CURATED_CARDS_PROMPT_VERSION,
    generatedAt: new Date().toISOString()
  };
}
