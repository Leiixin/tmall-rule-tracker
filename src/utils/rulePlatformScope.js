/**
 * 判断规则所属平台范围，支持 manifest 中的 weeklyMatchers 扩展。
 */

const TMALL_INTL_BOTH_TITLE = /天猫\/天猫国际|天猫国际.*天猫/;
const TMALL_INTL_TITLE = /天猫国际/;
const TMALL_HK_URL = /rule\.tmall\.hk/i;

/** @type {Map<string, { titlePatterns: RegExp[], urlPatterns: RegExp[] }>} */
const platformMatchers = new Map();

/**
 * @param {{ platforms?: Array<{ id: string, weeklyScope?: string, weeklyMatchers?: { titlePatterns?: string[], urlPatterns?: string[] } }> }} manifest
 */
export function registerPlatformMatchers(manifest) {
  platformMatchers.clear();
  const list = manifest?.platforms || [];
  for (const p of list) {
    const scope = p.weeklyScope || p.id;
    if (!scope || scope === "tmall" || scope === "intl") {
      continue;
    }
    const wm = p.weeklyMatchers || {};
    platformMatchers.set(scope, {
      titlePatterns: (wm.titlePatterns || []).map(
        (pat) => new RegExp(pat, "i")
      ),
      urlPatterns: (wm.urlPatterns || []).map((pat) => new RegExp(pat, "i"))
    });
  }
}

function matchesRegisteredScope(rule, weeklyScope) {
  const matchers = platformMatchers.get(weeklyScope);
  if (!matchers) {
    return false;
  }
  const title = rule?.title || "";
  const url = rule?.url || "";
  if (matchers.titlePatterns.some((re) => re.test(title))) {
    return true;
  }
  if (matchers.urlPatterns.some((re) => re.test(url))) {
    return true;
  }
  return false;
}

/**
 * @param {{ title?: string, url?: string, platformScope?: string }} rule
 * @returns {string}
 */
export function getRulePlatformScope(rule) {
  const scope = rule?.platformScope;
  if (typeof scope === "string" && scope.length > 0) {
    return scope;
  }
  const title = rule?.title || "";
  const url = rule?.url || "";

  for (const [platformScope] of platformMatchers) {
    if (matchesRegisteredScope(rule, platformScope)) {
      return platformScope;
    }
  }

  if (TMALL_HK_URL.test(url)) {
    return "intl";
  }
  if (TMALL_INTL_BOTH_TITLE.test(title)) {
    return "both";
  }
  if (TMALL_INTL_TITLE.test(title)) {
    return "intl";
  }
  return "tmall";
}

/**
 * @param {object} rule
 * @param {string} weeklyScope
 */
export function ruleMatchesWeeklyScope(rule, weeklyScope) {
  if (rule?.platformScope === weeklyScope) {
    return true;
  }
  if (weeklyScope === "tmall" || weeklyScope === "intl") {
    const ps = getRulePlatformScope(rule);
    if (weeklyScope === "intl") {
      return ps === "intl" || ps === "both";
    }
    return ps === "tmall" || ps === "both";
  }
  return matchesRegisteredScope(rule, weeklyScope);
}
