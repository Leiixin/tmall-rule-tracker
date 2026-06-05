import { chatJsonRaw, isLlmEnabled } from "./client.js";
import {
  CURATED_CARDS_PROMPT_VERSION,
  buildCuratedCardsSystemPrompt,
  buildCuratedCardsUserPrompt,
  isDouyinPenaltyImplementationSource,
  isDouyinPenaltyTableSource,
  isDouyinShipCategory,
  isScoreCategory
} from "./curatedCardsPrompts.js";
import { buildRuleDetailUrl } from "../../utils/ruleDetailUrl.js";
import dayjs from "dayjs";

const VALID_SEVERITY = new Set(["critical", "warning", "info", "normal"]);

const SCORE_METRIC_TITLE_RE =
  /商品负反馈率|商品好评率|48小时揽收|物流到货时长|物流差评率|旺旺3分钟|旺旺满意度|退款处理时长|平台求助率|商品综合评分|商品品质退货率|揽收时长|运单配送时效|发货物流品退|售后处理时长达成|飞鸽平均响应|飞鸽人工平均响应/;

const DOUYIN_FORMAL_COLUMNS = ["评分维度", "细分指标", "指标定义", "考核周期"];

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

export function countPenaltyTierUnits(html) {
  const lis = String(html || "").match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
  let count = lis.filter((li) => {
    const liPlain = li.replace(/<[^>]+>/g, " ");
    if (/认定[：:①②③④⑤⑥⑦⑧⑨]/.test(liPlain)) {
      return false;
    }
    return /扣罚|赔付|实付|违约金|%/.test(liPlain);
  }).length;

  const tds = String(html || "").match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
  count += tds.filter((td) => {
    const tdPlain = td.replace(/<[^>]+>/g, " ");
    return /扣罚|赔付|实付|违约金|%/.test(tdPlain);
  }).length;

  return count;
}

export function validateShipCardBody(body, { strictDouyin = false } = {}) {
  const html = String(body || "");
  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  if (!html.includes('class="highlight"')) {
    throw new Error("ship card body must include span.highlight markup");
  }
  if (!html.includes('class="num"')) {
    throw new Error("ship card body must include span.num markup");
  }

  if (strictDouyin && REFERENCE_BODY_RE.test(plain)) {
    throw new Error("ship card must not reference other rules in body");
  }
}

export function validatePenaltyCardBody(body, { strictDouyin = false, source } = {}) {
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
    if (countPenaltyTierUnits(html) < 2) {
      throw new Error(
        "douyin penalty card must have at least 2 penalty tier units (li or table cells)"
      );
    }
    if (isDouyinPenaltyTableSource(source) && !/card-penalty-table/.test(html)) {
      throw new Error(
        "douyin shipping timeout/stockout card must use card-penalty-table for penalties"
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

export function validateScoreNoteCardTitle(title) {
  const t = String(title || "").trim();
  if (SCORE_METRIC_TITLE_RE.test(t)) {
    throw new Error("score note card title must not name a formal metric");
  }
}

export function validateFormalStageMetrics(block, { platform } = {}) {
  const rows = Array.isArray(block?.rows) ? block.rows : [];
  if (rows.length < 3) {
    throw new Error("formalStageMetrics must have at least 3 rows");
  }

  const douyinRule =
    block?.tableFormat === "douyinRule" || platform === "douyin";

  if (douyinRule) {
    const cols = Array.isArray(block.columns) ? block.columns : [];
    if (
      cols.length !== 4 ||
      !DOUYIN_FORMAL_COLUMNS.every((c, i) => cols[i] === c)
    ) {
      throw new Error(
        `douyin formalStageMetrics columns must be ${JSON.stringify(DOUYIN_FORMAL_COLUMNS)}`
      );
    }
    for (const [index, row] of rows.entries()) {
      const dimension = String(row?.dimension || "").trim();
      const metric = String(row?.metric || "").trim();
      const definitionHtml = String(
        row?.definitionHtml || row?.detailHtml || ""
      ).trim();
      const assessmentPeriod = String(row?.assessmentPeriod || "").trim();
      if (!dimension || !metric || !definitionHtml) {
        throw new Error(
          `formalStageMetrics row ${index} missing dimension/metric/definitionHtml`
        );
      }
      if (!assessmentPeriod) {
        throw new Error(`formalStageMetrics row ${index} missing assessmentPeriod`);
      }
    }
    return {
      heading: String(block.heading || "正式阶段考核指标").slice(0, 40),
      subheading: block.subheading ? String(block.subheading).slice(0, 120) : "",
      tableFormat: "douyinRule",
      mergeDimension: Boolean(block.mergeDimension),
      columns: DOUYIN_FORMAL_COLUMNS,
      rows: rows.map((row) => ({
        dimension: String(row.dimension).slice(0, 24),
        metric: String(row.metric).slice(0, 40),
        definitionHtml: String(row.definitionHtml || row.detailHtml).slice(0, 2000),
        assessmentPeriod: String(row.assessmentPeriod).slice(0, 80)
      })),
      footnoteHtml: block.footnoteHtml
        ? String(block.footnoteHtml).slice(0, 600)
        : undefined
    };
  }

  for (const [index, row] of rows.entries()) {
    const dimension = String(row?.dimension || "").trim();
    const metric = String(row?.metric || "").trim();
    const detailHtml = String(row?.detailHtml || "").trim();
    if (!dimension || !metric || !detailHtml) {
      throw new Error(`formalStageMetrics row ${index} missing dimension/metric/detailHtml`);
    }
    if (!detailHtml.includes('class="highlight"')) {
      throw new Error(`formalStageMetrics row ${index} detailHtml must include highlight`);
    }
    if (!detailHtml.includes('class="num"')) {
      throw new Error(`formalStageMetrics row ${index} detailHtml must include num`);
    }
  }
  return {
    heading: String(block.heading || "正式阶段考核指标").slice(0, 40),
    subheading: block.subheading ? String(block.subheading).slice(0, 120) : "",
    columns: Array.isArray(block.columns) && block.columns.length
      ? block.columns.map((c) => String(c).slice(0, 20)).slice(0, 4)
      : ["维度", "指标", "计算公式/说明"],
    rows: rows.map((row) => ({
      dimension: String(row.dimension).slice(0, 24),
      metric: String(row.metric).slice(0, 40),
      detailHtml: String(row.detailHtml).slice(0, 500)
    })),
    footnoteHtml: block.footnoteHtml
      ? String(block.footnoteHtml).slice(0, 400)
      : undefined
  };
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
        validatePenaltyCardBody(body, { strictDouyin: true, source });
      } else if (isDouyinShipCategory(category, platform)) {
        validateShipCardBody(body, { strictDouyin: true });
      } else if (isScoreCategory(category)) {
        validateScoreNoteCardTitle(title);
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
  let formalStageMetrics;
  if (isScoreCategory(category) && parsed?.formalStageMetrics) {
    formalStageMetrics = validateFormalStageMetrics(parsed.formalStageMetrics, {
      platform
    });
  }
  const cards = normalizeCuratedCards(parsed, {
    source: { ...source, categories: [category] },
    platformModifiedAt: detail.publishedAt,
    category,
    platform,
    limits
  });

  return {
    cards,
    formalStageMetrics,
    promptVersion: CURATED_CARDS_PROMPT_VERSION,
    generatedAt: new Date().toISOString()
  };
}
