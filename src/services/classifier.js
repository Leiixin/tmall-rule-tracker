import dayjs from "dayjs";
import { CATEGORY_KEYWORDS, CATEGORY_LABELS } from "../config.js";

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text) {
  return normalizeText(text)
    .split(/[。；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function pickSentence(text, keywords) {
  const sentences = splitSentences(text);
  const matched = sentences.find((sentence) => containsAny(sentence, keywords));
  return matched || "未识别到明确描述";
}

function extractEffectivePeriod(text) {
  const normalized = normalizeText(text);
  const range = normalized.match(/((?:20\d{2}|19\d{2})[年\/.\-]\d{1,2}[月\/.\-]\d{1,2}日?)\s*(?:至|到|~|-)\s*((?:20\d{2}|19\d{2})[年\/.\-]\d{1,2}[月\/.\-]\d{1,2}日?)/);
  if (range) {
    return `${range[1]} 至 ${range[2]}`;
  }
  return pickSentence(normalized, CATEGORY_KEYWORDS.effectivePeriod);
}

function buildSummary(text) {
  return {
    effectivePeriod: extractEffectivePeriod(text),
    shopExperienceScore: pickSentence(text, CATEGORY_KEYWORDS.shopExperienceScore),
    shippingTimeliness: pickSentence(text, CATEGORY_KEYWORDS.shippingTimeliness),
    shippingViolationPenalty: pickSentence(text, CATEGORY_KEYWORDS.shippingViolationPenalty)
  };
}

function detectTags(text) {
  return Object.entries(CATEGORY_KEYWORDS)
    .filter(([, keywords]) => containsAny(text, keywords))
    .map(([key]) => key);
}

export function classifyRule(rule) {
  const text = normalizeText(`${rule.title || ""} ${rule.content || ""}`);
  return {
    ...rule,
    snippet: normalizeText(rule.content || "").slice(0, 220),
    tags: detectTags(text),
    summary: buildSummary(text)
  };
}

export function classifyRules(rules) {
  return rules.map(classifyRule);
}

function pickLatestByTag(rules, tag) {
  return rules
    .filter((rule) => Array.isArray(rule.tags) && rule.tags.includes(tag))
    .sort((a, b) => {
      const aTime = dayjs(a.publishedAt || a.lastSeenAt || 0).valueOf();
      const bTime = dayjs(b.publishedAt || b.lastSeenAt || 0).valueOf();
      return bTime - aTime;
    })[0];
}

export function buildDashboard(rules) {
  const cards = Object.keys(CATEGORY_KEYWORDS).map((category) => {
    const latestRule = pickLatestByTag(rules, category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      ruleTitle: latestRule?.title || "暂无匹配规则",
      source: latestRule?.source || "-",
      publishedAt: latestRule?.publishedAt || "-",
      url: latestRule?.url || "",
      detail: latestRule?.summary?.[category] || "未抓取到相关内容"
    };
  });

  return {
    updatedAt: new Date().toISOString(),
    totalRules: rules.length,
    cards
  };
}

export function filterRulesByCategory(rules, category) {
  if (!category || !CATEGORY_KEYWORDS[category]) {
    return rules;
  }
  return rules.filter((rule) => Array.isArray(rule.tags) && rule.tags.includes(category));
}

function pickRelevantRules(rules, keywords, limit = 30) {
  const matched = rules.filter((rule) => {
    const text = normalizeText(`${rule.title || ""} ${rule.content || ""}`);
    return keywords.some((keyword) => text.includes(keyword));
  });

  return matched
    .sort((a, b) => {
      const aTime = dayjs(a.publishedAt || a.lastSeenAt || 0).valueOf();
      const bTime = dayjs(b.publishedAt || b.lastSeenAt || 0).valueOf();
      return bTime - aTime;
    })
    .slice(0, limit);
}

function topTitles(rules, count = 3) {
  return rules.slice(0, count).map((rule) => ({
    title: rule.title || "未命名规则",
    publishedAt: rule.publishedAt || "-"
  }));
}

function extractMoneyLevels(text) {
  const strictMatches = [
    ...text.matchAll(/(?:违约金|赔付)[^。；\n]{0,16}?(\d+(?:\.\d+)?)\s*(万)?元/g)
  ];
  const fallbackMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(万)?元/g)];
  const source = strictMatches.length ? strictMatches : fallbackMatches;

  const values = source.map((item) => {
    const value = Number(item[1]);
    return item[2] ? value * 10000 : value;
  });
  const unique = [...new Set(values.filter((value) => value >= 1000))].sort(
    (a, b) => a - b
  );
  return unique.slice(0, 6);
}

function formatMoney(value) {
  if (value >= 10000) {
    return `${value / 10000}万元`;
  }
  return `${value}元`;
}

function buildEffectiveConclusions(rules) {
  const relevant = pickRelevantRules(rules, [
    "公示",
    "生效",
    "执行",
    "过渡期",
    "修订",
    "通知"
  ]);
  const sample = relevant.map((rule) => normalizeText(rule.content || "")).join(" ");

  const findings = [
    "规则更新以“公示 -> 生效 -> 执行”节奏为主，适合按生效日建立变更日历。",
    sample.includes("过渡期")
      ? "部分重点规则存在过渡期，过渡期内通常需完成系统参数与履约策略切换。"
      : "多数规则在公示后短期生效，准备窗口较短。"
  ];

  const actions = [
    "维护一份“未来30天生效规则清单”，按生效日拆分负责人。",
    "公示当日完成影响评估，最晚在生效前3天完成配置变更与客服话术更新。",
    "在规则生效周按天复盘异常订单、投诉与时效数据。"
  ];

  return {
    category: "effectivePeriod",
    label: CATEGORY_LABELS.effectivePeriod,
    latestPublishedAt: relevant[0]?.publishedAt || "-",
    ruleCount: relevant.length,
    findings,
    actions,
    latestRules: topTitles(relevant)
  };
}

function buildExperienceConclusions(rules) {
  const relevant = pickRelevantRules(rules, [
    "体验分",
    "店铺真实体验分",
    "宝贝质量",
    "物流速度",
    "服务保障",
    "48小时揽收及时率",
    "旺旺3分钟人工响应率"
  ]);
  const sample = relevant.map((rule) => normalizeText(rule.content || "")).join(" ");

  const findings = [
    sample.includes("搜索排序") || sample.includes("营销活动") || sample.includes("广告投放")
      ? "店铺体验分已与搜索、活动、投放等场景联动，直接影响流量与经营机会。"
      : "店铺体验分持续强化，对经营结果的影响高于单一售后指标。",
    sample.includes("商品负反馈率") && sample.includes("商品好评率")
      ? "评价体系从“差评导向”升级为“负反馈 + 好评”双向考核。"
      : "体验分指标覆盖宝贝质量、物流速度、服务保障等全链路维度。"
  ];

  const actions = [
    "建立体验分周报，按“质量/物流/服务”三维拆分负责人。",
    "优先压降48小时揽收、3分钟响应、退款处理时长三个高影响指标。",
    "将体验分目标纳入活动提报前置校验，避免临门一脚被卡。"
  ];

  return {
    category: "shopExperienceScore",
    label: CATEGORY_LABELS.shopExperienceScore,
    latestPublishedAt: relevant[0]?.publishedAt || "-",
    ruleCount: relevant.length,
    findings,
    actions,
    latestRules: topTitles(relevant)
  };
}

function buildShippingConclusions(rules) {
  const relevant = pickRelevantRules(rules, [
    "发货",
    "物流时效",
    "揽收",
    "轨迹异常",
    "轨迹超时",
    "今日发",
    "24小时发",
    "春节"
  ]);
  const sample = relevant.map((rule) => normalizeText(rule.content || "")).join(" ");

  const findings = [
    sample.includes("春节")
      ? "节假日与大促会出现临时时效规则，需按活动窗口切换履约策略。"
      : "发货时效规则与活动机制绑定度高，需按周期动态调整。",
    sample.includes("轨迹异常") || sample.includes("轨迹超时")
      ? "平台对“有单号但轨迹异常/停滞”的识别更细，时效合规不等于上传单号。"
      : "发货考核重点已从“是否发货”转向“发货后轨迹连续性与到货时长”。"
  ];

  const actions = [
    "每日监控“支付到揽收时长 + 轨迹更新间隔 + 到货时长”三项指标。",
    "按区域与仓库设置应急阈值，出现轨迹停滞时主动触发补偿方案。",
    "活动前完成仓配压力演练，保障承诺时效与实际履约一致。"
  ];

  return {
    category: "shippingTimeliness",
    label: CATEGORY_LABELS.shippingTimeliness,
    latestPublishedAt: relevant[0]?.publishedAt || "-",
    ruleCount: relevant.length,
    findings,
    actions,
    latestRules: topTitles(relevant)
  };
}

function buildPenaltyConclusions(rules) {
  const relevant = pickRelevantRules(rules, [
    "违规",
    "处罚",
    "违约金",
    "扣分",
    "清退",
    "赔付",
    "监管店铺",
    "延长交易账期"
  ]);
  const sampleText = relevant.map((rule) => normalizeText(rule.content || "")).join(" ");
  const moneyLevels = extractMoneyLevels(sampleText);
  const moneyView = moneyLevels.length
    ? moneyLevels.map(formatMoney).join("、")
    : "未识别到明确金额";

  const findings = [
    "处罚结构普遍为“警告/纠正 -> 扣分与违约金 -> 清退”，且存在复发加重机制。",
    `近期规则文本中出现的常见处罚金额区间：${moneyView}。`
  ];

  const actions = [
    "优先排查虚假交易、虚假凭证、扰乱秩序等高风险行为，避免触发阶梯升级。",
    "每次违规都建立“原因-整改-复盘”闭环，重点防止同类问题二次发生。",
    "把“违约金金额 + 扣分次数 + 附加管控”纳入经营风险看板。"
  ];

  return {
    category: "shippingViolationPenalty",
    label: CATEGORY_LABELS.shippingViolationPenalty,
    latestPublishedAt: relevant[0]?.publishedAt || "-",
    ruleCount: relevant.length,
    findings,
    actions,
    latestRules: topTitles(relevant)
  };
}

export function buildConclusions(rules) {
  return {
    updatedAt: new Date().toISOString(),
    totalRules: rules.length,
    sections: [
      buildEffectiveConclusions(rules),
      buildExperienceConclusions(rules),
      buildShippingConclusions(rules),
      buildPenaltyConclusions(rules)
    ]
  };
}
