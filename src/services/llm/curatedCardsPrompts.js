export const CURATED_CARDS_PROMPT_VERSION = "1";

const CATEGORY_META = {
  shelf: {
    title: "商品效期要求",
    focus:
      "保质期、临期标注、禁售阈值、天猫国际效期入库要求；面向商家运营可执行的要点。"
  },
  score: {
    title: "店铺真实体验分",
    focus:
      "真实体验分定义、三大维度指标、计算公式、应用场景、违规降分；突出2026年新规变化。"
  },
  ship: {
    title: "发货时效",
    focus:
      "发货时限、发货认定、物流轨迹超时与异常认定、免责情形；不写赔付比例（留给处罚类）。"
  },
  penalty: {
    title: "发货违规及处罚",
    focus:
      "延迟发货、缺货、虚假发货、轨迹超时/异常的认定与赔付比例、处罚措施。"
  }
};

export function buildCuratedCardsSystemPrompt(category) {
  const meta = CATEGORY_META[category] || { title: category, focus: "" };
  return `你是天猫商家运营顾问。根据用户提供的规则原文，为「${meta.title}」分类页生成展示卡片 JSON（不要 markdown）。

分类侧重：${meta.focus}

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
- 生成 3～8 张卡片，按主题拆分，不要把所有内容挤进一张。
- body 使用 <ul><li>，重要数字用 <span class="num">，重点用 <span class="highlight">。
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
