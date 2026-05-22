import axios from "axios";

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

function normalizeSummaryPayload(parsed) {
  const highlight = String(parsed?.highlight || "").trim();
  const impacts = Array.isArray(parsed?.impacts)
    ? parsed.impacts.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const actions = Array.isArray(parsed?.actions)
    ? parsed.actions.map((s) => String(s).trim()).filter(Boolean)
    : [];

  if (!highlight) {
    throw new Error("LLM summary missing highlight");
  }

  return {
    highlight: highlight.slice(0, 280),
    impacts: impacts.slice(0, 4),
    actions: actions.slice(0, 5)
  };
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
