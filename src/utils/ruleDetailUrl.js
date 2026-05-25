/**
 * 规则详情页链接规范化（多平台 ruleHosts 白名单）。
 */

const DEFAULT_RULE_HOSTS = ["rulechannel.tmall.com", "rule.tmall.hk"];

/** @type {string[]} */
let registeredRuleHosts = [...DEFAULT_RULE_HOSTS];

/**
 * @param {string[]} hosts
 */
export function registerRuleHosts(hosts) {
  const merged = new Set(DEFAULT_RULE_HOSTS);
  for (const h of hosts || []) {
    if (h && typeof h === "string") {
      merged.add(h.trim());
    }
  }
  registeredRuleHosts = [...merged];
}

/**
 * @param {{ platforms?: Array<{ ruleHosts?: string[] }> }} manifest
 */
export function registerRuleHostsFromManifest(manifest) {
  const hosts = [];
  for (const p of manifest?.platforms || []) {
    if (Array.isArray(p.ruleHosts)) {
      hosts.push(...p.ruleHosts);
    }
  }
  registerRuleHosts(hosts);
}

function hostMatchesRegistered(hostname) {
  return registeredRuleHosts.some((h) => hostname.includes(h));
}

export function buildRuleDetailUrl(ruleId, categoryId, host = "rulechannel.tmall.com") {
  const params = new URLSearchParams({
    type: "detail",
    ruleId: String(ruleId || "")
  });
  if (categoryId != null && String(categoryId) !== "") {
    params.set("cId", String(categoryId));
  }
  const qs = params.toString();
  if (host.includes("rule.tmall.hk")) {
    return `https://rule.tmall.hk/?${qs}`;
  }
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
    if (!hostMatchesRegistered(u.hostname)) {
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

    return buildRuleDetailUrl(ruleId, cId, u.hostname);
  } catch {
    return s;
  }
}
