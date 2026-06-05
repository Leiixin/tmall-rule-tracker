/**
 * Static + optional HTTP probe for Douyin score table col 3 (session 3cfe71).
 * Run: node scripts/debug-douyin-def-column.mjs
 */
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const logPath = path.join(repoRoot, "..", "debug-3cfe71.log");

function logLine(payload) {
  appendFileSync(
    logPath,
    JSON.stringify({ sessionId: "3cfe71", timestamp: Date.now(), ...payload }) + "\n"
  );
}

const raw = readFileSync(path.join(repoRoot, "data", "douyin", "curated-cards.json"), "utf8");
const data = JSON.parse(raw.replace(/^\uFEFF/, ""));
const rows = data?.sections?.score?.formalStageMetrics?.rows || [];
const targets = rows.filter((r) => /发货物流品退|飞鸽平均响应/.test(r.metric || ""));
for (const r of targets) {
  const def = String(r.definitionHtml || "");
  logLine({
    runId: "static-data-check",
    hypothesisId: "H1",
    location: "debug-douyin-def-column.mjs",
    message: "definitionHtml soft breaks in data",
    data: {
      metric: r.metric,
      hasWbr: def.includes("wbr"),
      hasBrAfter产生: def.includes("且产生<br>"),
      hasBrInFeigeNote: def.includes("人工客服会话，<br>"),
      hasFormulaWbr: def.includes("/ <wbr>") || def.includes("/<wbr>"),
    },
  });
}

const baseUrl = process.env.DEBUG_BASE_URL || "http://127.0.0.1:8765/index.html";
try {
  const res = await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
  const html = await res.text();
  logLine({
    runId: "static-html-check",
    hypothesisId: "H1",
    location: "debug-douyin-def-column.mjs",
    message: "served index has enhanceDouyinDefinitionHtml",
    data: {
      baseUrl,
      ok: res.ok,
      hasEnhanceFn: html.includes("enhanceDouyinDefinitionHtml"),
      hasDefInner: html.includes("card-score-def-inner"),
      hasMaxWidth0: /max-width:\s*0/.test(html),
    },
  });
} catch (e) {
  logLine({
    runId: "static-html-check",
    hypothesisId: "H1",
    message: "index fetch skipped",
    data: { baseUrl, error: String(e.message || e) },
  });
}

console.log("Wrote", logPath);
