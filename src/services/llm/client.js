import axios from "axios";

import {
  ACTION_LEGACY_PREFIXES,
  ACTION_SECTION_KEYS,
  HIGHLIGHT_PREFIXES,
  HIGHLIGHT_SECTION_KEYS,
  IMPACT_LEGACY_PREFIXES,
  IMPACT_SECTION_KEYS,
  flattenActionsStructured,
  flattenHighlightsStructured,
  flattenImpactsStructured
} from "./prompts.js";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

const HIGHLIGHT_LEGACY_MAP = HIGHLIGHT_SECTION_KEYS.map((key) => ({
  key,
  prefixes: [`${key}：`]
}));

export function getLlmConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "";
  return {
    apiKey,
    baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 90000)
  };
}

export function isLlmEnabled() {
  const flag = String(process.env.ENABLE_LLM_SUMMARY || "").toLowerCase();
  if (flag === "false" || flag === "0") {
    return false;
  }
  if (flag === "true" || flag === "1") {
    return Boolean(getLlmConfig().apiKey);
  }
  return Boolean(getLlmConfig().apiKey);
}

export function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("empty LLM response");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("failed to parse LLM JSON");
  }
}

function normalizeCore(text) {
  return String(text || "")
    .replace(
      /^(核心变化|适用范围|生效时间|对商家有利|对商家不利|有利|不利|中性（合规成本）|中性|运营组|客服组|物流组)[：:]\s*/u,
      ""
    )
    .replace(/^\d+[.、．]\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function stripEnumPrefix(text) {
  return String(text || "")
    .replace(/^\d+[.、．]\s*/, "")
    .trim()
    .slice(0, 120);
}

function migrateFlatToStructured(lines, legacyMap) {
  const structured = {};
  for (const line of lines) {
    const raw = String(line || "").trim();
    if (!raw) {
      continue;
    }
    for (const { key, prefixes } of legacyMap) {
      const matched = prefixes.find((p) => raw.startsWith(p));
      if (matched) {
        const body = stripEnumPrefix(raw.slice(matched.length));
        if (body) {
          if (!structured[key]) {
            structured[key] = [];
          }
          if (structured[key].length < 4) {
            structured[key].push(body);
          }
        }
        break;
      }
    }
  }
  return structured;
}

function normalizeStructuredFromParsed(
  parsed,
  fieldName,
  sectionKeys,
  legacyMap,
  flatFields
) {
  const structured = {};

  if (parsed?.[fieldName] && typeof parsed[fieldName] === "object") {
    for (const key of sectionKeys) {
      const arr = parsed[fieldName][key];
      if (!Array.isArray(arr)) {
        continue;
      }
      const points = arr
        .map((p) => stripEnumPrefix(p))
        .filter(Boolean)
        .slice(0, 4);
      if (points.length) {
        structured[key] = points;
      }
    }
  }

  if (!Object.keys(structured).length) {
    for (const flatField of flatFields) {
      if (Array.isArray(parsed?.[flatField])) {
        Object.assign(
          structured,
          migrateFlatToStructured(
            parsed[flatField].map((s) => String(s).trim()).filter(Boolean),
            legacyMap
          )
        );
      }
    }
  }

  return structured;
}

export function normalizeHighlightsStructured(parsed) {
  const structured = normalizeStructuredFromParsed(
    parsed,
    "highlightsStructured",
    HIGHLIGHT_SECTION_KEYS,
    HIGHLIGHT_LEGACY_MAP,
    ["highlights"]
  );

  if (!Object.keys(structured).length && parsed?.highlight) {
    structured["核心变化"] = [
      stripEnumPrefix(String(parsed.highlight).slice(0, 240))
    ].filter(Boolean);
  }

  return structured;
}

export function normalizeImpactsStructured(parsed) {
  return normalizeStructuredFromParsed(
    parsed,
    "impactsStructured",
    IMPACT_SECTION_KEYS,
    IMPACT_LEGACY_PREFIXES,
    ["impacts"]
  );
}

export function normalizeActionsStructured(parsed) {
  const structured = normalizeStructuredFromParsed(
    parsed,
    "actionsStructured",
    ACTION_SECTION_KEYS,
    ACTION_LEGACY_PREFIXES,
    ["actions"]
  );

  const impactsFlat = flattenImpactsStructured(
    normalizeImpactsStructured(parsed)
  );
  const impactCores = impactsFlat.map((line) => normalizeCore(line));

  for (const key of ACTION_SECTION_KEYS) {
    if (!Array.isArray(structured[key])) {
      continue;
    }
    structured[key] = structured[key].filter((point) => {
      const core = normalizeCore(point);
      if (core.length < 8) {
        return true;
      }
      return !impactCores.some((ic) => ic.includes(core) || core.includes(ic));
    });
    if (!structured[key].length) {
      delete structured[key];
    }
  }

  return structured;
}

function normalizeSummaryPayload(parsed) {
  const highlightsStructured = normalizeHighlightsStructured(parsed);
  let impactsStructured = normalizeImpactsStructured(parsed);
  let actionsStructured = normalizeActionsStructured(parsed);

  if (!Object.keys(highlightsStructured).length) {
    throw new Error("LLM summary missing highlightsStructured");
  }
  if (!Object.keys(impactsStructured).length) {
    impactsStructured = {
      中性: ["需结合经营类目评估规则影响，建议查阅原文。"]
    };
  }

  return {
    highlightsStructured,
    highlights: flattenHighlightsStructured(highlightsStructured),
    impactsStructured,
    impacts: flattenImpactsStructured(impactsStructured),
    actionsStructured,
    actions: flattenActionsStructured(actionsStructured)
  };
}

export {
  highlightsMissBreachPromiseRule,
  summaryMissRedPacketCompensation,
  summaryNeedsQualityRetry
} from "../../utils/summaryQuality.js";

async function postChatJson({ system, user, temperature = 0.2 }) {
  const { apiKey, baseUrl, model, timeoutMs } = getLlmConfig();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set");
  }

  const body = {
    model,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };

  if (String(process.env.LLM_JSON_MODE || "true").toLowerCase() !== "false") {
    body.response_format = { type: "json_object" };
  }

  const response = await axios.post(`${baseUrl}/chat/completions`, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    timeout: timeoutMs
  });

  const content = response.data?.choices?.[0]?.message?.content;
  return extractJsonObject(content);
}

export async function chatJsonRaw({ system, user, temperature }) {
  return postChatJson({ system, user, temperature });
}

export async function chatJson({ system, user, temperature }) {
  return normalizeSummaryPayload(
    await postChatJson({ system, user, temperature })
  );
}
