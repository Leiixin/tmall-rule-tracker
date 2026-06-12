export const PROMPT_VERSION = "10";

export const INLINE_HIGHLIGHT_SPAN_RULE =
  "重要数字、日期、金额、比例用 <span class=\"num\">...</span>；关键规则名、处罚机制、时效等重点用 <span class=\"highlight\">...</span>";

export const INLINE_HIGHLIGHT_MARKUP_RULE = `${INLINE_HIGHLIGHT_SPAN_RULE}；禁止其它 HTML 标签。`;

const RULE_SUMMARY_JSON_EXAMPLE = `{
  "highlightsStructured": {
    "核心变化": [
      "新增<span class=\\"highlight\\">品牌质保</span>服务：收货后<span class=\\"num\\">7</span>天内告知检测结论",
      "多次维修未解决（≥<span class=\\"num\\">2</span>次）须<span class=\\"highlight\\">免费调换</span>同型号商品"
    ],
    "适用范围": [
      "适用于加入<span class=\\"highlight\\">品牌质保</span>服务的天猫商家"
    ],
    "生效时间": [
      "本规范于<span class=\\"num\\">2026</span>年<span class=\\"num\\">6</span>月<span class=\\"num\\">2</span>日生效"
    ]
  },
  "impactsStructured": {
    "不利": [
      "超时未履约须支付<span class=\\"highlight\\">赔付红包</span>，单笔最高<span class=\\"num\\">300</span>元"
    ],
    "有利": [
      "展示<span class=\\"highlight\\">N年质保</span>标识，提升转化与信任"
    ],
    "中性": [
      "须按品牌官方条款区分主要部件与非主要部件质保期"
    ]
  },
  "actionsStructured": {
    "运营组": ["检查商品详情页是否展示质保标识"],
    "客服组": ["培训客服掌握质保申请路径"],
    "物流组": ["确保发货商品符合质保时效要求"]
  }
}`;
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

输出格式（要点字符串内须直接嵌入 span，勿用纯文本占位）：
${RULE_SUMMARY_JSON_EXAMPLE}

结构化字段通用规则：
- 键名见各对象说明；无依据的键不要输出。
- 每个键的值为字符串数组，表示该维度/组下的分点（1～4 条）；编号由系统渲染，数组项不要写「1.」前缀。
- 禁止把多个处罚层级、多种违约后果合并成一条笼统表述。
- 单条 20～55 字。
- ${INLINE_HIGHLIGHT_MARKUP_RULE}
- highlightsStructured 与 impactsStructured 的每条要点须至少一处 span.highlight（禁止纯文本或仅用 span.num）；规则名称、服务名称、处罚机制、平台动作须用 highlight；数字日期金额用 num。
- actionsStructured 要点为纯文本，不要求 span.highlight。

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

export const RULE_SUMMARY_SYSTEM_PROMPT_DOUYIN = `你是抖音电商（抖店）商家运营与平台规则顾问。根据用户提供的规则标题、发布时间与正文，输出严格 JSON（不要 markdown 代码块）。

三列分工（禁止重复、禁止同义复述）：
1. highlightsStructured 重点内容：只写客观事实，不写友好/不友好判断，不写应做什么。
2. impactsStructured 商家影响：只写对商家经营有利/不利/中性合规成本的判断，不写各组具体动作。
3. actionsStructured 流程建议：只写各组可执行措施，不要重复 impactsStructured 中的风险结论。

输出格式与键名约束与天猫规则摘要相同；JSON 示例见天猫 prompt（highlightsStructured / impactsStructured / actionsStructured，键名分别为核心变化/适用范围/生效时间、不利/有利/中性、运营组/客服组/物流组）。

抖音场景侧重（原文有则写，无则勿编造）：
- 商品上架、效期、库存与下架展示要求；
- 店铺/商品体验分、信用分、流量与活动报名门槛；
- 发货、揽收、物流时效与虚假发货/延迟发货处罚；
- 违规扣分、保证金、赔付、限制经营等处罚层级须分条摘录；
- 原文出现的规则名称（含书名号）、时效、金额、赔付形式须保留。

结构化字段通用规则：
- 每个键的值为字符串数组（1～4 条），单条 20～55 字；禁止合并多种处罚为一条空泛表述。
- ${INLINE_HIGHLIGHT_MARKUP_RULE}
- highlightsStructured 与 impactsStructured 的每条要点须至少一处 span.highlight（禁止纯文本或仅用 span.num）；actionsStructured 不要求 highlight。
- 使用简体中文；只依据原文；信息不足则保守表述。`;

export function getRuleSummarySystemPrompt(platform) {
  if (platform === "douyin") {
    return RULE_SUMMARY_SYSTEM_PROMPT_DOUYIN;
  }
  return RULE_SUMMARY_SYSTEM_PROMPT;
}

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

export function buildRuleSummaryUserPrompt(rule, contentMaxChars, platform = "tmall") {
  const title = rule.title || "未命名规则";
  const publishedAt = rule.publishedAt || rule.lastSeenAt || "未知";
  const content = String(rule.content || "").slice(0, contentMaxChars);
  const defaultSource =
    platform === "douyin"
      ? "抖音电商规则学习中心（规则动态）"
      : "天猫规则中心";
  const extraHint =
    platform === "douyin"
      ? "若正文含体验分、发货时效、违规扣分或赔付，「核心变化」须分条摘录并保留原文数字与规则名称。"
      : "若正文含服务保障、违规处理、赔付金额，「核心变化」须按处罚层级分条摘录，并保留书名号规则名、时效与金额数字。";
  return `标题：${title}
发布时间：${publishedAt}
来源：${rule.source || defaultSource}

正文：
${content}

请按 system 输出 JSON。三个 structured 对象均为「键名 + 要点数组」；impacts 用不利/有利/中性；actions 用运营组/客服组/物流组；三者勿重复。
输出须为合法 JSON；highlightsStructured 与 impactsStructured 的每条要点字符串内直接嵌入 span.highlight / span.num，勿输出 markdown。
${extraHint}`;
}
