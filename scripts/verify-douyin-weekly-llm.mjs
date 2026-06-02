import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import { classifyRules } from "../src/services/classifier.js";
import { isLlmEnabled } from "../src/services/llm/client.js";
import { getLastWeekRange, buildWeeklyReport } from "../src/services/weeklyReport.js";
import { isDouyinWeeklyRule } from "../src/utils/weeklyEligibility.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(repoRoot, "data", "douyin");
const rulesPath = path.join(dataDir, "rules.json");

function hasAiSummary(rule) {
  const ai = rule?.aiSummary;
  if (!ai) {
    return false;
  }
  return Boolean(
    (ai.highlightsStructured && Object.keys(ai.highlightsStructured).length) ||
      (ai.impactsStructured && Object.keys(ai.impactsStructured).length) ||
      (ai.actionsStructured && Object.keys(ai.actionsStructured).length) ||
      (Array.isArray(ai.highlights) && ai.highlights.length) ||
      (Array.isArray(ai.impacts) && ai.impacts.length) ||
      (Array.isArray(ai.actions) && ai.actions.length) ||
      ai.highlight
  );
}

function hasEnoughContent(rule) {
  return Boolean(rule?.content && String(rule.content).length >= 80);
}

const raw = await readFile(rulesPath, "utf8");
const rules = classifyRules(JSON.parse(raw), { platform: "douyin" });
const range = getLastWeekRange();
const weeklyRules = rules.filter((rule) => isDouyinWeeklyRule(rule, range));
const withContent = weeklyRules.filter(hasEnoughContent);
const withAi = weeklyRules.filter(hasAiSummary);
const report = buildWeeklyReport(rules, new Date(), "douyin");
const reportAi = report.items.filter((item) => item.aiGenerated);

const payload = {
  ok: true,
  llmEnabled: isLlmEnabled(),
  range: report.range,
  weeklyTotal: weeklyRules.length,
  weeklyWithContent: withContent.length,
  weeklyWithAiSummary: withAi.length,
  weeklyReportItems: report.total,
  weeklyReportAiGenerated: reportAi.length,
  samples: weeklyRules.slice(0, 5).map((rule) => ({
    title: rule.title?.slice(0, 60),
    publishedAt: rule.publishedAt,
    contentLen: String(rule.content || "").length,
    hasAi: hasAiSummary(rule)
  }))
};

if (weeklyRules.length === 0) {
  payload.ok = true;
  payload.note = "上周无抖音公告类规则，跳过 AI 覆盖率检查";
} else if (!isLlmEnabled()) {
  payload.ok = false;
  payload.error = "LLM 未启用：请设置 ENABLE_LLM_SUMMARY=true 与 DEEPSEEK_API_KEY";
} else if (withContent.length > 0 && withAi.length === 0) {
  payload.ok = false;
  payload.error =
    "上周公告规则有正文但无 aiSummary，请运行 crawl:douyin 或 summarize --platform=douyin";
} else if (report.total > 0 && reportAi.length === 0 && withAi.length === 0) {
  payload.ok = false;
  payload.error = "周度报告未产生 AI 解读条目";
}

console.log(JSON.stringify(payload, null, 2));
process.exit(payload.ok ? 0 : 1);
