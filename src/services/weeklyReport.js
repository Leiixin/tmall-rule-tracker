import dayjs from "dayjs";
import { CATEGORY_LABELS } from "../config.js";
import { classifyRule } from "./classifier.js";
import { normalizeHighlightsStructured } from "./llm/client.js";
import { flattenHighlightsStructured } from "./llm/prompts.js";

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

function pickHighlightsStructured(rule) {
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
    for (const key of Object.keys(CATEGORY_LABELS)) {
      const line = summary[key];
      if (line && line !== "未识别到明确描述") {
        structured["核心变化"] = [line.slice(0, 240)];
        break;
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
      tags.map((t) => CATEGORY_LABELS[t] || t).join("、")
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

function buildImpact(rule) {
  const ai = rule.aiSummary;
  if (Array.isArray(ai?.impacts) && ai.impacts.length) {
    return ai.impacts.slice(0, 3);
  }

  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  const impacts = [];

  if (tags.includes("effectivePeriod")) {
    impacts.push(
      "对商家不利：涉及效期与上架展示要求，可能影响 SKU 标注、下架与活动报名资格。"
    );
  }
  if (tags.includes("shopExperienceScore")) {
    impacts.push(
      "对商家不利：体验分与搜索、活动资源位挂钩，指标波动将直接影响流量与转化。"
    );
  }
  if (tags.includes("shippingTimeliness")) {
    impacts.push(
      "对商家不利：发货揽收时效不达标可能触发体验分降权、赔付与投诉上升。"
    );
  }
  if (tags.includes("shippingViolationPenalty")) {
    impacts.push(
      "对商家不利：违规与赔付标准明确，直接增加售后成本与账户处罚风险。"
    );
  }
  if (!impacts.length) {
    impacts.push(
      "中性（合规成本）：规则可能调整履约或售后要求，需结合类目评估合规与成本。"
    );
  }
  return impacts.slice(0, 3);
}

function buildActions(rule) {
  const ai = rule.aiSummary;
  if (Array.isArray(ai?.actions) && ai.actions.length) {
    return ai.actions.slice(0, 3);
  }

  const tags = Array.isArray(rule.tags) ? rule.tags : [];
  const actions = [];

  if (tags.includes("effectivePeriod")) {
    actions.push("运营组：维护「未来30天生效规则」日历，生效前完成详情页与库存复核。");
  }
  if (tags.includes("shopExperienceScore")) {
    actions.push("运营组：建立体验分周报，拆解宝贝质量/物流/服务改进项。");
    actions.push("客服组：优先压降响应、退款处理时长等高权重服务指标。");
  }
  if (tags.includes("shippingTimeliness")) {
    actions.push("物流组：更新发货模板与揽收 SLA，设置轨迹停滞预警。");
  }
  if (tags.includes("shippingViolationPenalty")) {
    actions.push("客服组：梳理赔付场景，更新话术与自动同意策略。");
    actions.push("运营组：对高投诉 SKU 建立熔断，避免重复违规。");
  }
  if (!actions.length) {
    actions.push("运营组：组织共读原文并形成内部变更纪要。");
    actions.push("客服组：生效当周按日复盘投诉、超时与赔付指标。");
  }
  return [...new Set(actions)].slice(0, 3);
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
    .filter(
      (rule) =>
        inLastWeek(rule.publishedAt, range) || inLastWeek(rule.lastSeenAt, range)
    )
    .sort((a, b) => {
      const aTime = dayjs(a.publishedAt || a.lastSeenAt || 0).valueOf();
      const bTime = dayjs(b.publishedAt || b.lastSeenAt || 0).valueOf();
      return bTime - aTime;
    })
    .map((rule) => {
      const highlightsStructured = pickHighlightsStructured(rule);
      return {
      title: rule.title || "未命名规则",
      url: rule.url || "",
      publishedAt: rule.publishedAt || rule.lastSeenAt || null,
      source: rule.source || "天猫规则中心",
      tags: rule.tags || [],
      tagLabels: (rule.tags || []).map((t) => CATEGORY_LABELS[t] || t),
      highlightsStructured,
      highlights: flattenHighlightsStructured(highlightsStructured),
      impacts: buildImpact(rule),
      actions: buildActions(rule),
      aiGenerated: Boolean(
        (rule.aiSummary?.highlightsStructured &&
          Object.keys(rule.aiSummary.highlightsStructured).length) ||
          (Array.isArray(rule.aiSummary?.highlights) &&
            rule.aiSummary.highlights.length) ||
          rule.aiSummary?.highlight
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
