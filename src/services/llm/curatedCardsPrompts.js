import { INLINE_HIGHLIGHT_SPAN_RULE } from "./prompts.js";

export const CURATED_CARDS_PROMPT_VERSION = "2";

const CATEGORY_META = {
  shelf: {
    title: "商品效期要求",
    focus:
      "保质期、临期标注、禁售阈值；面向商家运营可执行的要点。",
    structureRules: `效期分类页卡片结构（必守）：
- 不同效期阶段/场景须分卡，禁止混在一张：临期标注与详情展示、临期天数分级或剩余比例阈值、禁售阈值、换算规则（如1月=30天）等各自独立成卡（原文有则写，无则跳过）。
- 原文涉及以下品类时，须各用独立卡片（标题点明品类）：化妆品（含美妆护肤等）、隐形眼镜（含护理液等关联品）、保健品（含保健食品/膳食补充/保健用品等原文表述）。
- 通用食品/其他类目可另卡；每张卡 body 只写该阶段或该品类要点。`,
    cardCount: "4～10"
  },
  score: {
    title: "店铺真实体验分",
    focus:
      "真实体验分定义、各维度指标、计算公式、应用场景、违规降分；突出新规变化。",
    structureRules: `体验分分类页卡片结构（必守）：
- 按原文顶层大指标分卡（如商品体验、物流体验、服务/售后体验等，以原文指标名为准，一指标一卡）。
- 每张卡 body 须含该指标的计算公式或计分逻辑（权重、分子分母、统计窗口、剔除规则等；原文有则摘录，无公式则写原文计分说明，禁止编造公式）。
- 可另卡写：体验分定义与星级区间、应用场景（活动/投放/联盟门槛）、违规降分（若原文有且属本分类）。`,
    cardCount: "4～10"
  },
  ship: {
    title: "发货时效",
    focus:
      "发货时限、发货认定、物流轨迹超时与异常认定、免责情形；不写赔付比例（留给处罚类）。",
    structureRules: null,
    cardCount: "3～8"
  },
  penalty: {
    title: "发货违规及处罚",
    focus:
      "延迟发货、缺货、虚假发货、轨迹超时/异常的认定与赔付比例、处罚措施。",
    structureRules: `违规分类页卡片结构（必守）：
- 卡片标题须为具体违规行为名称（如「发货超时」「缺货/无货」「虚假发货」「物流轨迹超时」），与原文细则名称一致，禁止笼统「违规处罚汇总」。
- 每张卡 body 必须包含：①违规定义或认定条件；②订单扣罚/赔付标准（比例、上下限、按实付/按单；分层处罚须分 li）。
- 不写发货时限认定（留给发货时效类）；只取处罚相关段落。`,
    cardCount: "4～10"
  },
  intl_expiry: {
    title: "效期与效期管理",
    focus:
      "天猫国际跨境在售商品的保质期、临期标注、禁售标准、效期信息展示真实性；适用于食品、美妆、保健品等类目。",
    structureRules: `国际效期卡片结构：同「商品效期要求」——阶段分卡；化妆品/隐形眼镜/保健品原文有则各独立成卡。`,
    cardCount: "4～10"
  },
  intl_logistics: {
    title: "跨境物流与发货",
    focus:
      "保税/直邮发货时效、物流轨迹、大促期间发货调整及交易流程；含天猫/天猫国际联合公告要点。",
    structureRules: null,
    cardCount: "3～8"
  },
  intl_qual: {
    title: "资质与品牌",
    focus: "品牌授权、资质文件、跨境经营资质与合规要求。",
    structureRules: null,
    cardCount: "3～8"
  },
  intl_penalty: {
    title: "违规与处罚",
    focus: "延迟发货、物流违规、效期违规等的认定与处罚措施。",
    structureRules: `国际违规卡片结构：同「发货违规及处罚」——标题为具体违规，body 含认定 + 扣罚标准。`,
    cardCount: "4～10"
  }
};

function advisorForPlatform(platform, category) {
  if (platform === "douyin") {
    return "抖音电商商家运营顾问";
  }
  if (platform === "intl" || String(category).startsWith("intl_")) {
    return "天猫国际跨境商家运营顾问";
  }
  return "天猫商家运营顾问";
}

export function buildCuratedCardsSystemPrompt(category, platform = "tmall") {
  const meta = CATEGORY_META[category] || {
    title: category,
    focus: "",
    structureRules: null,
    cardCount: "3～8"
  };
  const advisor = advisorForPlatform(platform, category);
  const structureBlock = meta.structureRules
    ? `\n${meta.structureRules}\n`
    : "";

  return `你是${advisor}。根据用户提供的规则原文，为「${meta.title}」分类页生成展示卡片 JSON（不要 markdown）。

分类侧重：${meta.focus}
${structureBlock}
输出格式：
{
  "cards": [
    {
      "title": "卡片标题（8~30字）",
      "severity": "critical|warning|info|normal",
      "severityText": "强制|警告|参考|通知等",
      "date": "YYYY-MM-DD",
      "tags": ["标签1", "标签2"],
      "body": "<ul><li>要点</li></ul>"
    }
  ]
}

规则：
- 生成 ${meta.cardCount} 张卡片，按主题拆分，不要把所有内容挤进一张。
- body 使用 <ul><li>，${INLINE_HIGHLIGHT_SPAN_RULE}。
- 每条 li 15～50 字；只依据原文，禁止编造；信息不足则保守表述。
- date 使用用户提供的平台修订日期。
- 不要输出 link 字段（由系统补充）。
- 使用简体中文。`;
}

export function buildCuratedCardsUserPrompt({
  category,
  ruleTitle,
  platformModifiedAt,
  content,
  maxChars = 8000
}) {
  const meta = CATEGORY_META[category] || { title: category };
  return `分类：${meta.title}
规则标题：${ruleTitle || "未知"}
平台修订时间：${platformModifiedAt || "未知"}

正文：
${String(content || "").slice(0, maxChars)}

请输出 cards JSON，仅包含本分类相关要点。`;
}
