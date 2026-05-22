export const PROMPT_VERSION = "4";

export const HIGHLIGHT_SECTION_KEYS = ["核心变化", "适用范围", "生效时间"];

export const HIGHLIGHT_PREFIXES = HIGHLIGHT_SECTION_KEYS.map((k) => `${k}：`);

export const IMPACT_PREFIXES = ["对商家有利：", "对商家不利：", "中性（合规成本）：", "中性："];

export const ACTION_TEAM_PREFIXES = ["运营组：", "客服组：", "物流组："];

export const RULE_SUMMARY_SYSTEM_PROMPT = `你是天猫商家运营与平台规则顾问。根据用户提供的规则标题、发布时间与正文，输出严格 JSON（不要 markdown 代码块）。

三列分工（禁止重复、禁止同义复述）：
1. highlightsStructured 重点内容：只写客观事实，不写友好/不友好判断，不写应做什么。
2. impacts 商家影响：只写对商家有利/不利/中性合规成本，不写各组具体动作。
3. actions 流程建议：只写运营组/客服组/物流组可执行措施，不要重复 impacts 结论。

输出格式：
{
  "highlightsStructured": {
    "核心变化": ["要点1", "要点2"],
    "适用范围": ["要点1"],
    "生效时间": ["要点1", "要点2"]
  },
  "impacts": ["对商家有利：…", "对商家不利：…"],
  "actions": ["运营组：…", "客服组：…"]
}

highlightsStructured 要求（核心变化、适用范围、生效时间三者规则相同）：
- 键名只能是「核心变化」「适用范围」「生效时间」；无依据的键不要输出。
- 每个键的值为字符串数组，表示该维度下的分点（1～3 条）；编号由系统渲染，数组项不要写「1.」前缀。
- 禁止把多个要点合并成数组中的一个长字符串；禁止输出扁平 highlights 长段落。
- 单条要点 15～50 字，简洁客观。

impacts：1～3 条，以「对商家有利：」「对商家不利：」「中性（合规成本）：」或「中性：」开头。
actions：1～3 条，以「运营组：」「客服组：」「物流组：」开头。
使用简体中文；只依据原文；信息不足则保守表述。三列之间不得同义重复。`;

export function flattenHighlightsStructured(structured) {
  const flat = [];
  for (const key of HIGHLIGHT_SECTION_KEYS) {
    const items = structured?.[key];
    if (!Array.isArray(items)) {
      continue;
    }
    for (const point of items) {
      const text = String(point || "").trim();
      if (text) {
        flat.push(`${key}：${text.slice(0, 200)}`);
      }
    }
  }
  return flat;
}

export function buildRuleSummaryUserPrompt(rule, contentMaxChars) {
  const title = rule.title || "未命名规则";
  const publishedAt = rule.publishedAt || rule.lastSeenAt || "未知";
  const content = String(rule.content || "").slice(0, contentMaxChars);
  return `标题：${title}
发布时间：${publishedAt}
来源：${rule.source || "天猫规则中心"}

正文：
${content}

请按 system 输出 JSON。highlightsStructured 下「核心变化」「适用范围」「生效时间」均为要点数组（结构相同，可 1～3 条/维度）；impacts 写有利/不利/中性；actions 写各组动作；勿重复。`;
}
