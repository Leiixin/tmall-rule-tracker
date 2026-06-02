import {
  DOUYIN_GRAPH_ID,
  DOUYIN_ROOT_NODE_ID,
  DOUYIN_RULE_SOURCE_LABEL,
  DOUYIN_SEARCH_KEYWORDS,
  DOUYIN_DYNAMICS_SOURCE_SUFFIX,
  DOUYIN_DYNAMICS_SECTION_URL,
  DOUYIN_DYNAMICS_LIST_PARAMS,
  MAX_DETAIL_FETCH,
  MAX_DOUYIN_CATALOG_PAGES,
  MAX_DOUYIN_DYNAMICS_LIST_PAGES,
  MAX_DOUYIN_PAGE_SIZE
} from "../config.js";
import { getLastWeekRange } from "../services/weeklyReport.js";
import {
  isDouyinAnnouncementLikeSource,
  isDouyinWeeklyRule
} from "../utils/weeklyEligibility.js";

const BASE_URL = "https://school.jinritemai.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "application/json, text/plain, */*",
  Referer: `${BASE_URL}/doudian/web/rules`,
  Origin: BASE_URL
};

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function unixToIso(sec) {
  if (!sec) {
    return "";
  }
  const ms = Number(sec) * 1000;
  const parsed = new Date(ms);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function timeValue(iso) {
  const parsed = new Date(iso || 0);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function buildRuleUrl(id) {
  return `${BASE_URL}/doudian/web/rules/${encodeURIComponent(String(id))}`;
}

function buildArticleUrl(id) {
  return `${BASE_URL}/doudian/web/article/${encodeURIComponent(String(id))}`;
}

function buildDynamicsItemUrl(id) {
  const sid = String(id || "");
  if (/^\d+$/.test(sid)) {
    return buildRuleUrl(sid);
  }
  return buildArticleUrl(sid);
}

function extractSlugFromUrl(url) {
  const matched = String(url || "").match(/\/doudian\/web\/(?:rules|article)\/([^/?#]+)/i);
  return matched ? decodeURIComponent(matched[1]) : "";
}

export function extractDouyinDeltaText(content) {
  if (!content) {
    return "";
  }

  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const deltas = parsed?.deltas || parsed;
    const chunks = [];

    const walkOps = (ops) => {
      if (!Array.isArray(ops)) {
        return;
      }
      for (const op of ops) {
        if (typeof op?.insert === "string" && op.insert !== "*") {
          chunks.push(op.insert);
        }
      }
    };

    if (Array.isArray(deltas)) {
      for (const delta of deltas) {
        walkOps(delta?.ops);
      }
    } else if (deltas && typeof deltas === "object") {
      for (const key of Object.keys(deltas)) {
        walkOps(deltas[key]?.ops);
      }
    }

    return normalizeText(chunks.join(""));
  } catch {
    return normalizeText(String(content));
  }
}

async function douyinGetJson(path, params = {}, options = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    ...DEFAULT_HEADERS,
    ...(options.referer ? { Referer: options.referer } : {})
  };

  const response = await fetch(url.toString(), { headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Douyin API ${response.status}: ${text.slice(0, 200)}`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Douyin API invalid JSON: ${text.slice(0, 120)}`);
  }

  if (payload?.code !== 0) {
    throw new Error(payload?.msg || `Douyin API code ${payload?.code}`);
  }

  return payload.data;
}

function indexItemToRule(item, { source, content = "", weeklyChannel = null, url }) {
  const id = String(item.id || item.object_id || item.knowledge_id || "");
  const title = normalizeText(item.title || item.name || "");
  const publishedAt = unixToIso(
    item.update_at || item.update_time || item.create_at
  );

  const rule = {
    id,
    title,
    content,
    url: url || buildDynamicsItemUrl(id),
    source: source || DOUYIN_RULE_SOURCE_LABEL,
    platformScope: "douyin",
    lastSeenAt: new Date().toISOString(),
    snippet: normalizeText(content || item.summary || "").slice(0, 220)
  };

  if (publishedAt) {
    rule.publishedAt = publishedAt;
  }
  if (weeklyChannel) {
    rule.weeklyChannel = weeklyChannel;
  }

  return rule;
}

async function fetchCenterMain() {
  return douyinGetJson("/api/eschool/v1/rule/center/main", {
    new_rule_num: 6,
    violation_num: 6
  });
}

function mapRuleInfosToItems(ruleInfos) {
  return (ruleInfos || []).map((item) => ({
    id: item.knowledge_id,
    title: item.title,
    update_time: item.update_time,
    summary: item.summary
  }));
}

export async function fetchDynamicsSectionPage(page, pageSize, listParams = {}) {
  const params = {
    ...DOUYIN_DYNAMICS_LIST_PARAMS,
    ...listParams,
    page,
    page_size: pageSize
  };
  return douyinGetJson("/api/eschool/v1/rule/list", params, {
    referer: DOUYIN_DYNAMICS_SECTION_URL
  });
}

export async function crawlDouyinDynamicsSection(options = {}) {
  const maxPages = options.maxPages ?? MAX_DOUYIN_DYNAMICS_LIST_PAGES;
  const pageSize = options.pageSize ?? MAX_DOUYIN_PAGE_SIZE;
  const listParams = options.listParams || {};
  const dynamicsMeta = {
    source: `${DOUYIN_RULE_SOURCE_LABEL}${DOUYIN_DYNAMICS_SOURCE_SUFFIX}`,
    weeklyChannel: "announcement"
  };

  const ruleMap = new Map();
  let pagesFetched = 0;
  let totalFromApi = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const data = await fetchDynamicsSectionPage(page, pageSize, listParams);
      if (page === 1) {
        totalFromApi = Number(data?.total) || 0;
      }
      const infos = mapRuleInfosToItems(data?.rule_infos);
      mergeIndexedRules(ruleMap, infos, dynamicsMeta);
      pagesFetched = page;
      if (!infos.length) {
        break;
      }
    } catch {
      break;
    }
  }

  return {
    rules: [...ruleMap.values()],
    report: {
      pagesFetched,
      totalFromApi,
      listParams: { ...DOUYIN_DYNAMICS_LIST_PARAMS, ...listParams },
      count: ruleMap.size
    }
  };
}

async function fetchCatalogPage(page, pageSize) {
  return douyinGetJson("/api/eschool/v2/library/article/list", {
    node_id: DOUYIN_ROOT_NODE_ID,
    page,
    page_size: pageSize
  });
}

export async function fetchDouyinRuleDetail(id, options = {}) {
  const slug = String(id || options.slug || "").trim();
  if (!slug) {
    return null;
  }

  const data = await douyinGetJson("/api/eschool/v2/library/article/detail", {
    id: slug,
    graphId: options.graphId || DOUYIN_GRAPH_ID,
    need_content: true
  });

  const info = data?.article_info;
  if (!info) {
    return null;
  }

  const content = extractDouyinDeltaText(info.content);
  if (!content && !info.name) {
    return null;
  }

  const ruleId = String(info.article_id || slug);
  return {
    ruleId,
    slug: ruleId,
    title: normalizeText(info.name || ""),
    url: buildDynamicsItemUrl(ruleId),
    publishedAt: unixToIso(info.update_at || info.create_at) || new Date().toISOString(),
    content: content.slice(0, 12000),
    crawledAt: new Date().toISOString(),
    origin: "douyin-bff"
  };
}

export async function fetchDouyinRuleDetailForCurated(source) {
  const slug =
    source?.slug ||
    source?.ruleId ||
    extractSlugFromUrl(source?.url) ||
    String(source?.id || "").replace(/^dy-rule-/, "");

  if (!slug) {
    return null;
  }

  return fetchDouyinRuleDetail(slug, { graphId: source?.graphId });
}

function mergeIndexedRules(map, items, meta) {
  for (const item of items || []) {
    const id = String(item.id || item.object_id || item.knowledge_id || "");
    if (!id) {
      continue;
    }
    const existing = map.get(id);
    const candidate = indexItemToRule(
      { ...item, id },
      {
        source: meta.source,
        content: existing?.content || "",
        weeklyChannel: meta.weeklyChannel || existing?.weeklyChannel || null
      }
    );
    const shouldApply =
      !existing ||
      meta.weeklyChannel === "announcement" ||
      timeValue(candidate.publishedAt) >= timeValue(existing.publishedAt);
    if (!shouldApply) {
      continue;
    }

    const merged = { ...existing, ...candidate };
    if (existing?.weeklyChannel === "announcement" && !meta.weeklyChannel) {
      merged.source = existing.source;
      merged.weeklyChannel = existing.weeklyChannel;
    }
    map.set(id, merged);
  }
}

function detailFetchSortKey(rule, range) {
  if (rule.content && rule.content.length > 80) {
    return 3;
  }
  if (isDouyinWeeklyRule(rule, range)) {
    return 0;
  }
  if (isDouyinAnnouncementLikeSource(rule)) {
    return 1;
  }
  return 2;
}

async function fetchOneRuleDetail(ruleMap, rule) {
  if (rule.content && rule.content.length > 80) {
    return false;
  }
  try {
    const detail = await fetchDouyinRuleDetail(rule.id);
    if (detail?.content) {
      ruleMap.set(rule.id, {
        ...rule,
        title: detail.title || rule.title,
        content: detail.content,
        snippet: detail.content.slice(0, 220),
        publishedAt: detail.publishedAt || rule.publishedAt,
        url: detail.url || rule.url
      });
      return true;
    }
  } catch {
    // skip single rule failures
  }
  return false;
}

async function fetchDetailsForRules(ruleMap, limit, options = {}) {
  const range = getLastWeekRange();
  const weeklyBudget =
    options.weeklyDetailBudget ??
    Number(process.env.DOUYIN_WEEKLY_DETAIL_FETCH || 40);

  const weeklyCandidates = [...ruleMap.values()]
    .filter((rule) => isDouyinWeeklyRule(rule, range))
    .sort((a, b) => timeValue(b.publishedAt) - timeValue(a.publishedAt));

  let fetched = 0;
  let weeklyFetched = 0;
  for (const rule of weeklyCandidates) {
    if (weeklyFetched >= weeklyBudget) {
      break;
    }
    const updated = ruleMap.get(rule.id) || rule;
    if (await fetchOneRuleDetail(ruleMap, updated)) {
      fetched += 1;
      weeklyFetched += 1;
    }
  }

  const sorted = [...ruleMap.values()].sort((a, b) => {
    const keyDiff = detailFetchSortKey(a, range) - detailFetchSortKey(b, range);
    if (keyDiff !== 0) {
      return keyDiff;
    }
    return timeValue(b.publishedAt) - timeValue(a.publishedAt);
  });

  for (const rule of sorted) {
    if (fetched >= limit) {
      break;
    }
    const updated = ruleMap.get(rule.id) || rule;
    if (updated.content && updated.content.length > 80) {
      continue;
    }
    if (await fetchOneRuleDetail(ruleMap, updated)) {
      fetched += 1;
    }
  }
}

function matchesKeyword(title, keywords) {
  const text = normalizeText(title);
  return keywords.some((kw) => text.includes(kw));
}

export async function crawlDouyinRules(options = {}) {
  const keywords = options.searchKeywords || DOUYIN_SEARCH_KEYWORDS;
  const ruleMap = new Map();
  let dynamicsReport = null;

  for (let page = 1; page <= MAX_DOUYIN_CATALOG_PAGES; page += 1) {
    try {
      const data = await fetchCatalogPage(page, MAX_DOUYIN_PAGE_SIZE);
      mergeIndexedRules(ruleMap, data?.articles, { source: DOUYIN_RULE_SOURCE_LABEL });
      if (!data?.articles?.length || data.articles.length < MAX_DOUYIN_PAGE_SIZE) {
        break;
      }
    } catch {
      break;
    }
  }

  try {
    const center = await fetchCenterMain();
    const homeMeta = {
      source: `${DOUYIN_RULE_SOURCE_LABEL}（首页推荐）`,
      weeklyChannel: "announcement"
    };
    mergeIndexedRules(ruleMap, center?.rule_module?.list, {
      source: DOUYIN_RULE_SOURCE_LABEL
    });
    if (center?.latest_rule) {
      mergeIndexedRules(ruleMap, [center.latest_rule], homeMeta);
    }
  } catch {
    // center main optional
  }

  const section = await crawlDouyinDynamicsSection({
    maxPages: options.dynamicsListPages ?? MAX_DOUYIN_DYNAMICS_LIST_PAGES
  });
  dynamicsReport = section.report;
  for (const rule of section.rules) {
    const existing = ruleMap.get(rule.id);
    if (!existing) {
      ruleMap.set(rule.id, rule);
      continue;
    }
    ruleMap.set(rule.id, {
      ...existing,
      ...rule,
      source: rule.source,
      weeklyChannel: rule.weeklyChannel,
      url: rule.url,
      publishedAt: rule.publishedAt || existing.publishedAt
    });
  }

  if (keywords.length) {
    const keywordHits = [...ruleMap.values()].filter((rule) =>
      matchesKeyword(rule.title, keywords)
    );
    for (const rule of keywordHits.slice(0, 20)) {
      ruleMap.set(rule.id, rule);
    }
  }

  await fetchDetailsForRules(ruleMap, options.maxDetailFetch || MAX_DETAIL_FETCH);

  const rules = [...ruleMap.values()].filter((rule) => rule.title);
  if (options.returnReport) {
    return { rules, dynamicsReport };
  }
  return rules;
}

export async function crawlDouyinTimeline() {
  const items = [];
  try {
    const data = await fetchDynamicsSectionPage(1, 16);
    for (const row of data?.rule_infos || []) {
      const id = row.knowledge_id;
      items.push({
        title: row.title,
        url: buildDynamicsItemUrl(id),
        publishedAt: unixToIso(row.update_time),
        source: `${DOUYIN_RULE_SOURCE_LABEL}${DOUYIN_DYNAMICS_SOURCE_SUFFIX}`
      });
    }
  } catch {
    // ignore
  }

  return items;
}

export async function buildDouyinTimelineJson(timestamp = new Date().toISOString()) {
  const rows = await crawlDouyinTimeline();
  return {
    lastUpdated: timestamp,
    items: rows.map((row) => {
      const d = new Date(row.publishedAt || timestamp);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return {
        date: Number.isNaN(d.getTime()) ? "--" : `${mm}-${dd}`,
        text: row.title || "未命名规则",
        link: row.url || ""
      };
    })
  };
}

