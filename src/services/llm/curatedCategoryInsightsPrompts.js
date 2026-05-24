export const CURATED_INSIGHTS_PROMPT_VERSION = "1";

const CATEGORY_META = {
  shelf: {
    title: "商品效期要求",
    focus: "保质期、临期标注、禁售阈值；变更对在售商品发布与库存的影响。"
  },
  score: {
    title: "店铺真实体验分",
    focus: "体验分指标、计算、应用场景、违规降分；变更对考核与流量的影响。"
  },
  ship: {
    title: "发货时效",
    focus: "发货时限、揽收与物流轨迹认定、免责情形；变更对履约流程的影响。"
  },
  penalty: {
    title: "发货违规及处罚",
    focus: "延迟发货、缺货、虚假发货、轨迹类违规的认定与赔付；变更对赔付与店铺处罚的影响。"
  }
};

export function buildCategoryInsightsSystemPrompt(category) {
  const meta = CATEGORY_META[category] || { title: category, focus: "" };
  return `你是天猫商家运营顾问。根据规则原文（及可选的变更前摘要），为「${meta.title}」分类页生成规则变更解读 JSON（不要 markdown）。

分类侧重：${meta.focus}

输出格式：
{
  "panelSubtitle": "一句话说明本次变更背景（8~40字）",
  "changes": [
    { "type": "new|modify|remove", "title": "变更标题", "detail": "客观事实描述，可用 <span class=\\"new-val\\">/<span class=\\"old\\">", "date": "YYYY-MM-DD" }
  ],
  "impacts": [
    { "level": "high|medium|low", "title": "影响标题", "desc": "对商家的影响，可用 <span class=\\"warn\\"> 强调" }
  ],
  "strategies": [
    { "level": "action", "title": "建议标题", "desc": "可执行建议，可用 <span class=\\"good\\"> 强调" }
  ]
}

规则：
- changes 3～7 条，impacts 3～6 条，strategies 3～6 条。
- 只依据提供的规则正文与变更说明，禁止编造：不得出现正文未载明的具体扣分（如 −0.3分）、活动专名（如大促名称）、未出现的公式常数。
- 正文写「以产品页面为准」「得分档位标准」时须沿用，不得替换成具体数字。
- detail/desc 为简体中文，每条 20～80 字。
- 若无变更前正文，按新正文摘要「当前规则要点」与公示/修订信息撰写，勿虚构「旧版」细节。`;
}

export function buildCategoryInsightsUserPrompt({
  category,
  ruleTitle,
  platformModifiedAt,
  ruleUrl,
  previousContent,
  newContent,
  maxChars = 6000
}) {
  const meta = CATEGORY_META[category] || { title: category };
  const prev = String(previousContent || "").trim();
  const next = String(newContent || "").slice(0, maxChars);
  const prevBlock = prev
    ? `变更前正文摘要（供对比）：\n${prev.slice(0, maxChars)}`
    : "变更前正文：（无本地缓存，请仅根据下列新正文与标题撰写当前规则要点，勿编造旧版条款。）";

  return `分类：${meta.title}
规则标题：${ruleTitle || "未知"}
平台修订时间：${platformModifiedAt || "未知"}
规则链接：${ruleUrl || "未知"}

${prevBlock}

变更后/当前正文：
${next}

请输出 JSON。`;
}
