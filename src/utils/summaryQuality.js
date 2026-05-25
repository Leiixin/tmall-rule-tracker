/**
 * 周度 aiSummary 质量校验（无外部依赖，可供脚本与 LLM 重试共用）。
 */

export function highlightsMissBreachPromiseRule(rule, summary) {
  const content = String(rule?.content || "");
  if (!content.includes("《违背承诺的规则及实施细则》")) {
    return false;
  }
  const coreLines = summary?.highlightsStructured?.["核心变化"] || [];
  const coreText = coreLines.join("");
  return !/违背承诺|实施细则/.test(coreText);
}

export function summaryMissRedPacketCompensation(rule, summary) {
  const content = String(rule?.content || "");
  if (!/赔付红包|30元/.test(content)) {
    return false;
  }
  const blob = [
    ...(summary?.highlightsStructured?.["核心变化"] || []),
    ...(summary?.impactsStructured?.["不利"] || [])
  ].join("");
  return !/30|三十|红包/.test(blob);
}

export function summaryNeedsQualityRetry(rule, summary) {
  return (
    highlightsMissBreachPromiseRule(rule, summary) ||
    summaryMissRedPacketCompensation(rule, summary)
  );
}
