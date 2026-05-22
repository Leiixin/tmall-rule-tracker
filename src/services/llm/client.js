import axios from "axios";

import {
  ACTION_TEAM_PREFIXES,
  HIGHLIGHT_PREFIXES,
  HIGHLIGHT_SECTION_KEYS,
  IMPACT_PREFIXES,
  flattenHighlightsStructured
} from "./prompts.js";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

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

function extractJsonObject(text) {
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

function hasPrefix(line, prefixes) {
  return prefixes.some((p) => line.startsWith(p));
}

function dedupeByPrefix(lines, prefixes, max) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const prefix = prefixes.find((p) => line.startsWith(p));
    const key = prefix || line.slice(0, 24);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(line);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

function normalizeCore(text) {
  return String(text || "")
    .replace(/^(核心变化|适用范围|生效时间|对商家有利|对商家不利|中性（合规成本）|中性|运营组|客服组|物流组)[：:]\s*/u, "")
    .replace(/^\d+[.、．]\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function dropImpactsOverlappingActions(impacts, actions) {
  if (!actions.length) {
    return impacts;
  }
  const actionCores = actions.map((a) => normalizeCore(a));
  return impacts.filter((impact) => {
    const core = normalizeCore(impact);
    if (core.length < 8) {
      return true;
    }
    return !actionCores.some(
      (ac) => ac.includes(core) || core.includes(ac)
    );
  });
}

function stripEnumPrefix(text) {
  return String(text || "")
    .replace(/^\d+[.、．]\s*/, "")
    .trim()
    .slice(0, 120);
}

function migrateFlatHighlightsToStructured(lines) {
  const structured = {};
  for (const line of lines) {
    const raw = String(line || "").trim();
    if (!raw) {
      continue;
    }
    for (const key of HIGHLIGHT_SECTION_KEYS) {
      const prefix = `${key}：`;
      if (raw.startsWith(prefix)) {
        const body = stripEnumPrefix(raw.slice(prefix.length));
        if (body) {
          if (!structured[key]) {
            structured[key] = [];
          }
          if (structured[key].length < 3) {
            structured[key].push(body);
          }
        }
        break;
      }
    }
  }
  return structured;
}

export function normalizeHighlightsStructured(parsed) {
  const structured = {};

  if (parsed?.highlightsStructured && typeof parsed.highlightsStructured === "object") {
    for (const key of HIGHLIGHT_SECTION_KEYS) {
      const arr = parsed.highlightsStructured[key];
      if (!Array.isArray(arr)) {
        continue;
      }
      const points = arr
        .map((p) => stripEnumPrefix(p))
        .filter(Boolean)
        .slice(0, 3);
      if (points.length) {
        structured[key] = points;
      }
    }
  }

  if (!Object.keys(structured).length) {
    let lines = [];
    if (Array.isArray(parsed?.highlights)) {
      lines = parsed.highlights.map((s) => String(s).trim()).filter(Boolean);
    } else if (parsed?.highlight) {
      lines = [String(parsed.highlight).trim()];
    }
    Object.assign(structured, migrateFlatHighlightsToStructured(lines));
  }

  if (!Object.keys(structured).length && parsed?.highlight) {
    structured["核心变化"] = [
      stripEnumPrefix(String(parsed.highlight).slice(0, 240))
    ].filter(Boolean);
  }

  return structured;
}

function normalizeImpacts(parsed, actions) {
  let lines = Array.isArray(parsed?.impacts)
    ? parsed.impacts.map((s) => String(s).trim()).filter(Boolean)
    : [];

  lines = lines.filter((line) => !hasPrefix(line, ACTION_TEAM_PREFIXES));

  const prefixed = lines.filter((line) => hasPrefix(line, IMPACT_PREFIXES));
  let merged = dedupeByPrefix(
    prefixed.length ? prefixed : lines,
    IMPACT_PREFIXES,
    3
  ).map((line) => line.slice(0, 220));

  merged = dropImpactsOverlappingActions(merged, actions);
  return merged.slice(0, 3);
}

function normalizeActions(parsed, impacts) {
  let lines = Array.isArray(parsed?.actions)
    ? parsed.actions.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const prefixed = lines.filter((line) => hasPrefix(line, ACTION_TEAM_PREFIXES));
  let merged = dedupeByPrefix(
    prefixed.length ? prefixed : lines,
    ACTION_TEAM_PREFIXES,
    3
  ).map((line) => line.slice(0, 220));

  const impactCores = impacts.map((i) => normalizeCore(i));
  merged = merged.filter((action) => {
    const core = normalizeCore(action);
    if (core.length < 8) {
      return true;
    }
    return !impactCores.some((ic) => ic.includes(core) || core.includes(ic));
  });

  return merged.slice(0, 3);
}

function normalizeSummaryPayload(parsed) {
  const actions = normalizeActions(parsed, []);
  const impacts = normalizeImpacts(parsed, actions);
  const highlightsStructured = normalizeHighlightsStructured(parsed);
  const highlights = flattenHighlightsStructured(highlightsStructured);

  if (!Object.keys(highlightsStructured).length) {
    throw new Error("LLM summary missing highlightsStructured");
  }
  if (!impacts.length) {
    impacts.push("中性（合规成本）：需结合经营类目评估规则影响，建议查阅原文。");
  }

  return { highlightsStructured, highlights, impacts, actions };
}

export async function chatJson({ system, user }) {
  const { apiKey, baseUrl, model, timeoutMs } = getLlmConfig();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set");
  }

  const body = {
    model,
    temperature: 0.2,
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
  return normalizeSummaryPayload(extractJsonObject(content));
}
