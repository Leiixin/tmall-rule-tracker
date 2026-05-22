export const RULE_SUMMARY_SYSTEM_PROMPT = `你是天猫商家运营与平台规则顾问。根据用户提供的规则标题、发布时间与正文，输出严格 JSON（不要 markdown 代码块），格式如下：
{
  "highlight": "string，80-120字，概括本条规则核心变化、适用范围、关键生效时间",
  "impacts": ["string，每条一句，说明对天猫商家经营的可能影响，1-3条"],
  "actions": ["string，每条一句，可执行的后续流程调整建议，2-4条"]
}
要求：
- 使用简体中文，面向商家运营/客服/仓储负责人
- 只依据原文，不要编造原文未出现的具体金额、日期或处罚标准
- 若原文信息不足，用保守表述并提示查阅原文
- impacts 与 actions 不要重复同一句`;

export function buildRuleSummaryUserPrompt(rule, contentMaxChars) {
  const title = rule.title || "未命名规则";
  const publishedAt = rule.publishedAt || rule.lastSeenAt || "未知";
  const content = String(rule.content || "").slice(0, contentMaxChars);
  return `标题：${title}
发布时间：${publishedAt}
来源：${rule.source || "天猫规则中心"}

正文：
${content}`;
}
