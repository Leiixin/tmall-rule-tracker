export const PROMPT_VERSION = "5";

export const HIGHLIGHT_SECTION_KEYS = ["核心变化", "适用范围", "生效时间"];

export const HIGHLIGHT_PREFIXES = HIGHLIGHT_SECTION_KEYS.map((k) => `${k}：`);

export const IMPACT_SECTION_KEYS = ["不利", "有利", "中性"];

export const IMPACT_LEGACY_PREFIXES = [
  { key: "不利", prefixes: ["对商家不利：", "不利："] },
  { key: "有利", prefixes: ["对商家有利：", "有利："] },
  { key: "中性", prefixes: ["中性（合规成本）：", "中性："] }
];

export const ACTION_SECTION_KEYS = ["运营组", "客服组", "物流组"];

export const ACTION_LEGACY_PREFIXES = ACTION_SECTION_KEYS.map((key) => ({
  key,
  prefixes: [`${key}：`]
}));

/** @deprecated 兼容旧引用 */
export const IMPACT_PREFIXES = IMPACT_LEGACY_PREFIXES.flatMap((x) => x.prefixes);

export const ACTION_TEAM_PREFIXES = ACTION_LEGACY_PREFIXES.flatMap((x) => x.prefixes);

export const RULE_SUMMARY_SYSTEM_PROMPT = `你是天猫商家运营与平台规则顾问。根据用户提供的规则标题、发布时间与正文，输出严格 JSON（不要 markdown 代码块）。

三列分工（禁止重复、禁止同义复述）：
1. highlightsStructured 重点内容：只写客观事实，不写友好/不友好判断，不写应做什么。
2. impactsStructured 商家影响：只写对商家经营有利/不利/中性合规成本的判断，不写各组具体动作。
3. actionsStructured 流程建议：只写各组可执行措施，不要重复 impactsStructured 中的风险结论。

输出格式：
{
  "highlightsStructured": {
    "核心变化": ["要点1", "要点2"],
    "适用范围": ["要点1"],
    "生效时间": ["要点1"]
  },
  "impactsStructured": {
    "不利": ["要点1", "要点2"],
    "有利": ["要点1"],
    "中性": ["要点1"]
  },
  "actionsStructured": {
    "运营组": ["要点1", "要点2"],
    "客服组": ["要点1"],
    "物流组": ["要点1"]
  }
}

结构化字段通用规则（highlightsStructured / impactsStructured / actionsStructured 均相同）：
- 键名见各对象说明；无依据的键不要输出。
- 每个键的值为字符串数组，表示该维度/组下的分点（1～3 条）；编号由系统渲染，数组项不要写「1.」前缀。
- 禁止把多个要点合并成一个长字符串。
- 单条 15～50 字。

impactsStructured 键名只能是：不利、有利、中性。
actionsStructured 键名只能是：运营组、客服组、物流组。
使用简体中文；只依据原文；信息不足则保守表述。`;

export function flattenStructured(structured, sectionKeys) {
  const flat = [];
  for (const key of sectionKeys) {
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

export function flattenHighlightsStructured(structured) {
  return flattenStructured(structured, HIGHLIGHT_SECTION_KEYS);
}

export function flattenImpactsStructured(structured) {
  return flattenStructured(structured, IMPACT_SECTION_KEYS);
}

export function flattenActionsStructured(structured) {
  return flattenStructured(structured, ACTION_SECTION_KEYS);
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

请按 system 输出 JSON。三个 structured 对象均为「键名 + 要点数组」；impacts 用不利/有利/中性；actions 用运营组/客服组/物流组；三者勿重复。`;
}
