import {
  DOUYIN_GRAPH_ID,
  DOUYIN_ROOT_NODE_ID,
  DOUYIN_RULE_SOURCE_LABEL,
  DOUYIN_SEARCH_KEYWORDS,
  MAX_DETAIL_FETCH,
  MAX_DOUYIN_ANNOUNCEMENT_PAGES,
  MAX_DOUYIN_CATALOG_PAGES,
  MAX_DOUYIN_PAGE_SIZE
} from "../config.js";

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

async function douyinGetJson(path, params = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), { headers: DEFAULT_HEADERS });
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

function indexItemToRule(item, { source, content = "", weeklyChannel = null }) {
  const id = String(item.id || item.object_id || item.knowledge_id || "");
  const title = normalizeText(item.title || item.name || "");
  const publishedAt = unixToIso(
    item.update_at || item.update_time || item.create_at
  );

  const rule = {
    id,
    title,
    content,
    url: buildRuleUrl(id),
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
  return douyinGetJson("/api/eschool/v1/rule/center/main");
}

async function fetchAnnouncementPage(page, pageSize) {
  return douyinGetJson("/api/eschool/v1/rule/list", {
    rule_type: 0,
    page,
    page_size: pageSize
  });
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
    url: buildRuleUrl(ruleId),
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
    if (
      !existing ||
      timeValue(candidate.publishedAt) >= timeValue(existing.publishedAt)
    ) {
      map.set(id, { ...existing, ...candidate });
    }
  }
}

async function fetchDetailsForRules(ruleMap, limit) {
  const sorted = [...ruleMap.values()].sort(
    (a, b) => timeValue(b.publishedAt) - timeValue(a.publishedAt)
  );

  let fetched = 0;
  for (const rule of sorted) {
    if (fetched >= limit) {
      break;
    }
    if (rule.content && rule.content.length > 80) {
      continue;
    }

    try {
      const detail = await fetchDouyinRuleDetail(rule.id);
      if (detail?.content) {
        ruleMap.set(rule.id, {
          ...rule,
          title: detail.title || rule.title,
          content: detail.content,
          snippet: detail.content.slice(0, 220),
          publishedAt: detail.publishedAt || rule.publishedAt
        });
        fetched += 1;
      }
    } catch {
      // skip single rule failures
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

  try {
    const center = await fetchCenterMain();
    const homeMeta = {
      source: `${DOUYIN_RULE_SOURCE_LABEL}（首页推荐）`,
      weeklyChannel: "announcement"
    };
    mergeIndexedRules(ruleMap, center?.new_rules, homeMeta);
    mergeIndexedRules(ruleMap, center?.rule_module?.list, {
      source: DOUYIN_RULE_SOURCE_LABEL
    });
    if (center?.latest_rule) {
      mergeIndexedRules(ruleMap, [center.latest_rule], homeMeta);
    }
  } catch {
    // center main optional
  }

  for (let page = 1; page <= MAX_DOUYIN_ANNOUNCEMENT_PAGES; page += 1) {
    try {
      const data = await fetchAnnouncementPage(page, MAX_DOUYIN_PAGE_SIZE);
      const infos = (data?.rule_infos || []).map((item) => ({
        id: item.knowledge_id,
        title: item.title,
        update_time: item.update_time,
        summary: item.summary
      }));
      mergeIndexedRules(ruleMap, infos, {
        source: `${DOUYIN_RULE_SOURCE_LABEL}（公示通知）`,
        weeklyChannel: "announcement"
      });
      if (!infos.length || infos.length < MAX_DOUYIN_PAGE_SIZE) {
        break;
      }
    } catch {
      break;
    }
  }

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

  if (keywords.length) {
    const keywordHits = [...ruleMap.values()].filter((rule) =>
      matchesKeyword(rule.title, keywords)
    );
    for (const rule of keywordHits.slice(0, 20)) {
      ruleMap.set(rule.id, rule);
    }
  }

  await fetchDetailsForRules(ruleMap, options.maxDetailFetch || MAX_DETAIL_FETCH);

  return [...ruleMap.values()].filter((rule) => rule.title);
}

export async function crawlDouyinTimeline() {
  const items = [];
  try {
    const center = await fetchCenterMain();
    for (const row of center?.new_rules || []) {
      items.push({
        title: row.title,
        url: buildRuleUrl(row.id),
        publishedAt: unixToIso(row.update_at)
      });
    }
  } catch {
    // ignore
  }

  try {
    const data = await fetchAnnouncementPage(1, 10);
    for (const row of data?.rule_infos || []) {
      items.push({
        title: row.title,
        url: buildRuleUrl(row.knowledge_id),
        publishedAt: unixToIso(row.update_time)
      });
    }
  } catch {
    // ignore
  }

  return items;
}
