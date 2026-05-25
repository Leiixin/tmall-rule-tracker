export const PROMPT_VERSION = "6";

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
- 每个键的值为字符串数组，表示该维度/组下的分点（1～4 条）；编号由系统渲染，数组项不要写「1.」前缀。
- 禁止把多个处罚层级、多种违约后果合并成一条笼统表述。
- 单条 20～55 字。

highlightsStructured「核心变化」原文贴合（处罚/服务承诺类规则必守）：
- 原文若存在分层处罚（如超时未发货、拒绝履约、判责后红包赔付），须分条写出，禁止合并为「超时面临赔付风险」。
- 原文出现的规则全称（带书名号）须完整保留，禁止缩写为「违背承诺规则」等简称。
- 原文出现的时效（如 24 小时、5 天）、金额（如 30 元）、赔付形式（如赔付红包）须写入对应要点。
- 服务保障类规则尽量覆盖：响应时效、发货/履约时效、平台介入依据（含依据规则名称）、拒绝履约认定条件、判责后赔付标准（原文有则写）。

impactsStructured「不利」：
- 每条对应一种可触发的经营后果（成本、平台赔付、红包扣款、投诉判责等），与 highlights 中处罚条一一呼应。
- 禁止用「面临赔付风险」等空泛表述替代原文中的具体机制与数字。

actionsStructured：
- 只写各组可执行措施；涉及时效的须写明可落地检查点（如 24 小时内响应、24 小时内发货、5 天内完成补寄）。

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

请按 system 输出 JSON。三个 structured 对象均为「键名 + 要点数组」；impacts 用不利/有利/中性；actions 用运营组/客服组/物流组；三者勿重复。
若正文含服务保障、违规处理、赔付金额，「核心变化」须按处罚层级分条摘录，并保留书名号规则名、时效与金额数字。`;
}
