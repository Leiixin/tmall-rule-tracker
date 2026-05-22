/**
 * 天猫规则中心详情页链接（hash 路由），避免 /tmall/?type=detail 仅打开首页。
 * 与页面内嵌 TIMELINE_DATA 链接格式一致。
 */
export function buildRuleDetailUrl(ruleId, categoryId) {
  const params = new URLSearchParams({
    type: "detail",
    ruleId: String(ruleId || "")
  });
  if (categoryId != null && String(categoryId) !== "") {
    params.set("cId", String(categoryId));
  }
  const qs = params.toString();
  return `https://rulechannel.tmall.com/?${qs}#/rule/detail?${qs}`;
}

/** 将历史错误链接（含 /tmall/ 且无 hash）规范为可直达详情页的 URL */
export function normalizeRuleDetailUrl(raw) {
  if (!raw || typeof raw !== "string") {
    return "";
  }
  const s = raw.trim();
  if (!s) {
    return "";
  }
  if (s.includes("#/rule/detail")) {
    return s;
  }

  try {
    const u = new URL(s);
    if (!u.hostname.includes("rulechannel.tmall.com")) {
      return s;
    }

    let ruleId = u.searchParams.get("ruleId") || "";
    let cId = u.searchParams.get("cId") || "";

    if (!ruleId && u.hash) {
      const hashBody = u.hash.replace(/^#\/?/, "");
      const qIdx = hashBody.indexOf("?");
      const hashQuery = qIdx >= 0 ? hashBody.slice(qIdx + 1) : "";
      const hp = new URLSearchParams(hashQuery);
      ruleId = hp.get("ruleId") || ruleId;
      cId = hp.get("cId") || cId;
    }

    if (!ruleId) {
      return s;
    }

    return buildRuleDetailUrl(ruleId, cId);
  } catch {
    return s;
  }
}
