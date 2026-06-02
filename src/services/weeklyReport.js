import dayjs from "dayjs";
import { CATEGORY_LABELS, INTL_CATEGORY_LABELS, DOUYIN_CATEGORY_LABELS } from "../config.js";

const ALL_CATEGORY_LABELS = {
  ...CATEGORY_LABELS,
  ...INTL_CATEGORY_LABELS,
  ...DOUYIN_CATEGORY_LABELS
};
import { isRuleInWeeklyWindow } from "../utils/weeklyEligibility.js";
import { classifyRule } from "./classifier.js";
import {
  normalizeActionsStructured,
  normalizeHighlightsStructured,
  normalizeImpactsStructured
} from "./llm/client.js";
import {
  flattenActionsStructured,
  flattenHighlightsStructured,
  flattenImpactsStructured
} from "./llm/prompts.js";

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

const DOUYIN_SUMMARY_KEYS = ["shelf", "score", "ship", "penalty"];
const TMALL_SUMMARY_KEYS = [
  "effectivePeriod",
  "shopExperienceScore",
  "shippingTimeliness",
  "shippingViolationPenalty"
];

function pickHighlightsStructured(rule, weeklyScope = "tmall") {
  const ai = rule.aiSummary;
  if (
    ai?.highlightsStructured &&
    typeof ai.highlightsStructured === "object" &&
    Object.keys(ai.highlightsStructured).length
  ) {
    return ai.highlightsStructured;
  }
  if (Array.isArray(ai?.highlights) && ai.highlights.length) {
    return normalizeHighlightsStructured({ highlights: ai.highlights });
  }
  if (ai?.highlight) {
    return normalizeHighlightsStructured({ highlight: ai.highlight });
  }

  const structured = {};
  if (rule.snippet) {
    structured["核心变化"] = [rule.snippet.slice(0, 240)];
  } else {
    const summary = rule.summary || {};
    const keys =
      weeklyScope === "douyin" ? DOUYIN_SUMMARY_KEYS : TMALL_SUMMARY_KEYS;
    for (const key of keys) {
      const line = summary[key];
      if (line && line !== "未识别到明确描述") {
        structured["核心变化"] = [line.slice(0, 240)];
        break;
      }
    }
    if (!structured["核心变化"]) {
      for (const key of Object.keys(ALL_CATEGORY_LABELS)) {
        const line = summary[key];
        if (line && line !== "未识别到明确描述") {
          structured["核心变化"] = [line.slice(0, 240)];
          break;
        }
      }
    }
  }
  if (!structured["核心变化"]) {
    structured["核心变化"] = [
      `${rule.title || "规则更新"}，请查阅原文了解变更要点与生效安排。`
    ];
  }

  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  if (tags.length) {
    structured["适用范围"] = [
      tags.map((t) => ALL_CATEGORY_LABELS[t] || t).join("、")
    ];
  }

  const pub = rule.publishedAt || rule.lastSeenAt;
  if (pub) {
    const t = dayjs(pub);
    if (t.isValid()) {
      structured["生效时间"] = [t.format("YYYY年M月D日") + " 起适用/生效（以原文为准）"];
    }
  }

  return structured;
}

function pickImpactsStructured(rule) {
  const ai = rule.aiSummary;
  if (
    ai?.impactsStructured &&
    typeof ai.impactsStructured === "object" &&
    Object.keys(ai.impactsStructured).length
  ) {
    return ai.impactsStructured;
  }
  if (Array.isArray(ai?.impacts) && ai.impacts.length) {
    return normalizeImpactsStructured({ impacts: ai.impacts });
  }

  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  const structured = {};

  if (tags.includes("effectivePeriod")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "涉及效期与上架展示要求，可能影响 SKU 标注、下架与活动报名资格。"
    ];
  }
  if (tags.includes("shopExperienceScore")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "体验分与搜索、活动资源位挂钩，指标波动将直接影响流量与转化。"
    ];
  }
  if (tags.includes("shippingTimeliness")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "发货揽收时效不达标可能触发体验分降权、赔付与投诉上升。"
    ];
  }
  if (tags.includes("shippingViolationPenalty")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "违规与赔付标准明确，直接增加售后成本与账户处罚风险。"
    ];
  }
  if (tags.includes("shelf")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "涉及商品效期、上架或库存展示要求，可能影响 SKU 标注、下架与活动报名。"
    ];
  }
  if (tags.includes("score")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "体验分/信用分与流量、活动资源挂钩，指标波动将直接影响曝光与转化。"
    ];
  }
  if (tags.includes("ship")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "发货或揽收时效不达标可能触发体验分降权、赔付与客诉上升。"
    ];
  }
  if (tags.includes("penalty")) {
    structured["不利"] = [
      ...(structured["不利"] || []),
      "违规扣分、保证金或赔付标准明确，直接增加售后成本与限流风险。"
    ];
  }
  if (!Object.keys(structured).length) {
    structured["中性"] = [
      "规则可能调整履约或售后要求，需结合类目评估合规与成本。"
    ];
  }
  return structured;
}

function pickActionsStructured(rule, weeklyScope = "tmall") {
  const ai = rule.aiSummary;
  if (
    ai?.actionsStructured &&
    typeof ai.actionsStructured === "object" &&
    Object.keys(ai.actionsStructured).length
  ) {
    return ai.actionsStructured;
  }
  if (Array.isArray(ai?.actions) && ai.actions.length) {
    return normalizeActionsStructured({ actions: ai.actions });
  }

  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  const structured = {};

  if (tags.includes("effectivePeriod")) {
    structured["运营组"] = [
      "维护「未来30天生效规则」日历，生效前完成详情页与库存复核。"
    ];
  }
  if (tags.includes("shopExperienceScore")) {
    structured["运营组"] = [
      ...(structured["运营组"] || []),
      "建立体验分周报，拆解宝贝质量/物流/服务改进项。"
    ];
    structured["客服组"] = ["优先压降响应、退款处理时长等高权重服务指标。"];
  }
  if (tags.includes("shippingTimeliness")) {
    structured["物流组"] = ["更新发货模板与揽收 SLA，设置轨迹停滞预警。"];
  }
  if (tags.includes("shippingViolationPenalty")) {
    structured["客服组"] = ["梳理赔付场景，更新话术与自动同意策略。"];
    structured["运营组"] = [
      ...(structured["运营组"] || []),
      "对高投诉 SKU 建立熔断，避免重复违规。"
    ];
  }
  if (tags.includes("shelf")) {
    structured["运营组"] = [
      ...(structured["运营组"] || []),
      "维护效期与上架日历，生效前完成详情页、库存与资质复核。"
    ];
  }
  if (tags.includes("score")) {
    structured["运营组"] = [
      ...(structured["运营组"] || []),
      "建立体验分周报，拆解商品/物流/服务维度改进项。"
    ];
    structured["客服组"] = ["压降响应、售后纠纷等高权重服务指标。"];
  }
  if (tags.includes("ship")) {
    structured["物流组"] = ["更新发货模板与揽收 SLA，设置轨迹停滞与超时预警。"];
  }
  if (tags.includes("penalty")) {
    structured["客服组"] = [
      ...(structured["客服组"] || []),
      "梳理违规赔付场景，更新话术与判责协同流程。"
    ];
    structured["运营组"] = [
      ...(structured["运营组"] || []),
      "对高违规 SKU 建立熔断，避免重复扣分或限流。"
    ];
  }
  if (!Object.keys(structured).length) {
    structured["运营组"] = ["组织共读原文并形成内部变更纪要。"];
    structured["客服组"] = ["生效当周按日复盘投诉、超时与赔付指标。"];
  }
  return structured;
}

export function buildWeeklyReport(
  rules,
  reference = new Date(),
  weeklyScope = "tmall"
) {
  const range = getLastWeekRange(reference);
  const classified = (Array.isArray(rules) ? rules : []).map((rule) =>
    rule.tags && rule.summary ? rule : classifyRule(rule)
  );

  const items = classified
    .filter((rule) => isRuleInWeeklyWindow(rule, range, weeklyScope))
    .sort((a, b) => {
      const aTime = dayjs(a.publishedAt || a.lastSeenAt || 0).valueOf();
      const bTime = dayjs(b.publishedAt || b.lastSeenAt || 0).valueOf();
      return bTime - aTime;
    })
    .map((rule) => {
      const highlightsStructured = pickHighlightsStructured(rule, weeklyScope);
      const impactsStructured = pickImpactsStructured(rule, weeklyScope);
      const actionsStructured = pickActionsStructured(rule, weeklyScope);
      const defaultSource =
        weeklyScope === "douyin"
          ? "抖音电商规则学习中心"
          : weeklyScope === "intl"
            ? "天猫国际规则公示"
            : "天猫规则中心";
      return {
        title: rule.title || "未命名规则",
        url: rule.url || "",
        publishedAt: rule.publishedAt || rule.lastSeenAt || null,
        source: rule.source || defaultSource,
        highlightsStructured,
        highlights: flattenHighlightsStructured(highlightsStructured),
        impactsStructured,
        impacts: flattenImpactsStructured(impactsStructured),
        actionsStructured,
        actions: flattenActionsStructured(actionsStructured),
        aiGenerated: Boolean(
          rule.aiSummary &&
            ((rule.aiSummary.highlightsStructured &&
              Object.keys(rule.aiSummary.highlightsStructured).length) ||
              (rule.aiSummary.impactsStructured &&
                Object.keys(rule.aiSummary.impactsStructured).length) ||
              (rule.aiSummary.actionsStructured &&
                Object.keys(rule.aiSummary.actionsStructured).length) ||
              (Array.isArray(rule.aiSummary.highlights) &&
                rule.aiSummary.highlights.length) ||
              (Array.isArray(rule.aiSummary.impacts) &&
                rule.aiSummary.impacts.length) ||
              (Array.isArray(rule.aiSummary.actions) &&
                rule.aiSummary.actions.length) ||
              rule.aiSummary.highlight)
        )
      };
    });

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
