import dayjs from "dayjs";
import { CATEGORY_LABELS } from "../config.js";
import { classifyRule } from "./classifier.js";

/** 上周一 00:00:00 — 上周日 23:59:59（本地时区） */
export function getLastWeekRange(reference = new Date()) {
  const ref = dayjs(reference);
  const dayOfWeek = ref.day();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = ref.subtract(daysFromMonday, "day").startOf("day");
  const lastMonday = thisMonday.subtract(7, "day");
  const lastSunday = lastMonday.add(6, "day").endOf("day");
  return { start: lastMonday, end: lastSunday };
}

function pickHighlight(rule) {
  const ai = rule.aiSummary;
  if (ai?.highlight) {
    return String(ai.highlight).slice(0, 280);
  }
  if (rule.snippet) {
    return rule.snippet.slice(0, 240);
  }
  const summary = rule.summary || {};
  for (const key of Object.keys(CATEGORY_LABELS)) {
    const line = summary[key];
    if (line && line !== "未识别到明确描述") {
      return line.slice(0, 240);
    }
  }
  return `${rule.title || "规则更新"}：请查阅原文了解变更要点与生效安排。`;
}

function buildImpact(rule) {
  const ai = rule.aiSummary;
  if (Array.isArray(ai?.impacts) && ai.impacts.length) {
    return ai.impacts;
  }

  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  const impacts = [];

  if (tags.includes("effectivePeriod")) {
    impacts.push(
      "涉及商品效期、生效时间与上架展示要求，可能影响在售 SKU 的标注、下架与活动报名资格。"
    );
  }
  if (tags.includes("shopExperienceScore")) {
    impacts.push(
      "与店铺真实体验分及搜索排序、活动提报等资源位相关，指标波动将直接影响流量与转化。"
    );
  }
  if (tags.includes("shippingTimeliness")) {
    impacts.push(
      "约束发货、揽收与物流轨迹时效，超时可能触发体验分降权、赔付或消费者投诉。"
    );
  }
  if (tags.includes("shippingViolationPenalty")) {
    impacts.push(
      "明确违规场景、违约金或赔付标准，直接关联售后成本、账户处罚与申诉压力。"
    );
  }
  if (!impacts.length) {
    impacts.push(
      "规则变更可能调整履约、展示或售后处理要求，需结合经营类目评估合规与成本影响。"
    );
  }
  return impacts;
}

function buildActions(rule) {
  const ai = rule.aiSummary;
  if (Array.isArray(ai?.actions) && ai.actions.length) {
    return ai.actions.slice(0, 5);
  }

  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  const actions = [];

  if (tags.includes("effectivePeriod")) {
    actions.push("维护「未来30天生效规则」日历，按生效日拆分负责人。");
    actions.push("公示期内完成效期标注、详情页与库存批次筛查，生效前3天完成配置复核。");
  }
  if (tags.includes("shopExperienceScore")) {
    actions.push("建立体验分周报，按宝贝质量 / 物流速度 / 服务保障拆解改进项。");
    actions.push("优先压降48小时揽收、3分钟响应、退款处理时长等高权重指标。");
  }
  if (tags.includes("shippingTimeliness")) {
    actions.push("更新发货模板与揽收 SLA，对代发/中转订单设置轨迹停滞预警。");
    actions.push("大促前完成仓配产能测算，避免集中爆单导致揽收超时。");
  }
  if (tags.includes("shippingViolationPenalty")) {
    actions.push("梳理违约/赔付场景，更新客服话术与自动同意策略，降低判责率。");
    actions.push("对高投诉 SKU 建立熔断机制，避免重复违规扣分。");
  }
  if (!actions.length) {
    actions.push("组织运营、客服、仓储共读原文，形成内部变更纪要。");
    actions.push("生效当周按日复盘相关指标（投诉、超时、品退、赔付）。");
  }
  return [...new Set(actions)].slice(0, 4);
}

function inLastWeek(iso, range) {
  if (!iso) {
    return false;
  }
  const t = dayjs(iso);
  if (!t.isValid()) {
    return false;
  }
  return (
    (t.isAfter(range.start) || t.isSame(range.start)) &&
    (t.isBefore(range.end) || t.isSame(range.end))
  );
}

export function buildWeeklyReport(rules, reference = new Date()) {
  const range = getLastWeekRange(reference);
  const classified = (Array.isArray(rules) ? rules : []).map((rule) =>
    rule.tags && rule.summary ? rule : classifyRule(rule)
  );

  const items = classified
    .filter((rule) => inLastWeek(rule.publishedAt || rule.lastSeenAt, range))
    .sort((a, b) => {
      const aTime = dayjs(a.publishedAt || a.lastSeenAt || 0).valueOf();
      const bTime = dayjs(b.publishedAt || b.lastSeenAt || 0).valueOf();
      return bTime - aTime;
    })
    .map((rule) => ({
      title: rule.title || "未命名规则",
      url: rule.url || "",
      publishedAt: rule.publishedAt || rule.lastSeenAt || null,
      source: rule.source || "天猫规则中心",
      tags: rule.tags || [],
      tagLabels: (rule.tags || []).map((t) => CATEGORY_LABELS[t] || t),
      highlight: pickHighlight(rule),
      impacts: buildImpact(rule),
      actions: buildActions(rule),
      aiGenerated: Boolean(rule.aiSummary?.highlight)
    }));

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      label: `${range.start.format("YYYY年M月D日")} — ${range.end.format("M月D日")}（周一至周日）`
    },
    total: items.length,
    items
  };
}
