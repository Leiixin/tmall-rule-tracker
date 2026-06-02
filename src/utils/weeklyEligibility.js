import { ruleMatchesWeeklyScope } from "./rulePlatformScope.js";

export function inLastWeek(iso, range) {
  if (!iso) {
    return false;
  }
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) {
    return false;
  }
  return t >= range.start && t <= range.end;
}

/** 抖音周度：规则动态、公示通知、首页推荐等公告类来源 */
export function isDouyinAnnouncementLikeSource(rule) {
  if (!rule) {
    return false;
  }
  if (rule.weeklyChannel === "announcement") {
    return true;
  }
  const source = String(rule.source || "");
  return /规则动态|公示通知|首页推荐/.test(source);
}

export function isDouyinWeeklyRule(rule, range) {
  if (!isDouyinAnnouncementLikeSource(rule)) {
    return false;
  }
  return inLastWeek(rule.publishedAt, range);
}

/** 天猫国际周度：规则公示 / 公告类来源 */
export function isIntlAnnouncementLikeSource(rule) {
  if (!rule) {
    return false;
  }
  if (rule.weeklyChannel === "announcement") {
    return true;
  }
  const source = String(rule.source || "");
  return /规则公示/.test(source);
}

export function isIntlWeeklyRule(rule, range) {
  if (!isIntlAnnouncementLikeSource(rule)) {
    return false;
  }
  return inLastWeek(rule.publishedAt, range);
}

export function isRuleInWeeklyWindow(rule, range, weeklyScope) {
  if (!ruleMatchesWeeklyScope(rule, weeklyScope)) {
    return false;
  }
  if (weeklyScope === "douyin") {
    return isDouyinWeeklyRule(rule, range);
  }
  if (weeklyScope === "intl") {
    return isIntlWeeklyRule(rule, range);
  }
  return (
    inLastWeek(rule.publishedAt, range) || inLastWeek(rule.lastSeenAt, range)
  );
}
