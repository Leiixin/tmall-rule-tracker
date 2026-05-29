import { createHash } from "node:crypto";
import axios from "axios";
import * as cheerio from "cheerio";
import dayjs from "dayjs";
import {
  MAX_DETAIL_FETCH,
  MAX_LIST_PER_SOURCE,
  MAX_MTOP_LIST_PAGES,
  MTOP_APIS,
  MTOP_HK_SITE,
  MTOP_CN_SITE,
  MTOP_DETAIL_CONCURRENCY,
  MTOP_PAGE_SIZE,
  MTOP_SEARCH_KEYWORDS,
  MTOP_SEARCH_KEYWORDS_INTL,
  RULE_KEYWORDS,
  CRAWL_SOURCE_MANIFEST,
  CRAWL_SOURCE_MANIFEST_INTL,
  MTOP_HTML_SKIP_THRESHOLD,
  MTOP_RULE_SOURCE_LABEL,
  MTOP_HK_RULE_SOURCE_LABEL,
  TMALL_SOURCES,
  INTL_HTML_SOURCES
} from "../config.js";
import { buildRuleDetailUrl } from "../utils/ruleDetailUrl.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const pageClient = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml"
  }
});

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function toAbsoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function hasRuleKeyword(text) {
  return RULE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function extractDate(text) {
  const matched = text.match(
    /(20\d{2}(?:[\/.\-]|\u5e74)\d{1,2}(?:[\/.\-]|\u6708)\d{1,2}(?:\u65e5)?)/
  );
  if (!matched) {
    return "";
  }

  const normalized = matched[1]
    .replace(/\u5e74|\./g, "-")
    .replace(/\u6708/g, "-")
    .replace(/\u65e5/g, "")
    .replace(/\//g, "-");

  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.toISOString() : "";
}

function parseDateTime(value) {
  if (!value) {
    return "";
  }

  const parsed = dayjs(String(value).replace(/\//g, "-"));
  return parsed.isValid() ? parsed.toISOString() : "";
}

function htmlToText(html) {
  const $ = cheerio.load(`<section>${html || ""}</section>`);
  $("script,style,noscript").remove();
  return normalizeText($("section").text());
}

function parseMtopPayload(payload) {
  if (!payload) {
    return null;
  }

  if (typeof payload === "object") {
    return payload;
  }

  const text = String(payload).trim();
  const jsonText = text
    .replace(/^\s*mtopjsonp1\(/, "")
    .replace(/\)\s*$/, "");

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function isMtopSuccess(payload) {
  return (
    Array.isArray(payload?.ret) &&
    payload.ret.some((item) => String(item).startsWith("SUCCESS"))
  );
}

function isMtopTokenError(payload) {
  const ret = Array.isArray(payload?.ret) ? payload.ret.join("|") : "";
  return (
    ret.includes("FAIL_SYS_TOKEN_EMPTY") ||
    ret.includes("FAIL_SYS_TOKEN_EXOIRED") ||
    ret.includes("FAIL_SYS_SESSION_EXOIRED") ||
    ret.includes("FAIL_SYS_ILLEGAL_ACCESS")
  );
}

async function mapLimit(items, limit, mapper) {
  const result = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      result[current] = await mapper(items[current], current);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.max(1, limit); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return result;
}

class MtopRuleClient {
  constructor(site = MTOP_CN_SITE) {
    this.site = site;
    this.cookieHeader = "";
    this.token = "";
    this.http = axios.create({
      timeout: 20000,
      headers: {
        "User-Agent": USER_AGENT,
        Referer: site.referer,
        Origin: site.origin
      },
      validateStatus: () => true
    });
  }

  baseData(data = {}) {
    return {
      identityCode: this.site.identityCode,
      terminal: this.site.terminal,
      buCode: this.site.buCode,
      ...data
    };
  }

  endpoint(api) {
    return `https://h5api.m.taobao.com/h5/${api}/${this.site.version}/`;
  }

  async refreshToken(api, data) {
    const baseData = this.baseData(data);
    const dataString = JSON.stringify(baseData);

    const response = await this.http.get(this.endpoint(api), {
      params: {
        jsv: "2.7.4",
        appKey: this.site.appKey,
        t: Date.now().toString(),
        sign: "",
        api,
        v: this.site.version,
        type: "jsonp",
        dataType: "jsonp",
        callback: "mtopjsonp1",
        data: dataString
      }
    });

    const cookieItems = (response.headers["set-cookie"] || []).map((item) =>
      item.split(";")[0]
    );
    this.cookieHeader = cookieItems.join("; ");

    const tkEntry =
      cookieItems.find((item) => item.startsWith("_m_h5_tk=")) || "";
    const tkRaw = tkEntry.split("=")[1] || "";
    this.token = tkRaw.split("_")[0] || "";
  }

  async call(api, data = {}, retry = true) {
    const baseData = this.baseData(data);
    const dataString = JSON.stringify(baseData);

    if (!this.token || !this.cookieHeader) {
      await this.refreshToken(api, baseData);
    }

    const t = Date.now().toString();
    const sign = md5(`${this.token}&${t}&${this.site.appKey}&${dataString}`);

    const response = await this.http.get(this.endpoint(api), {
      params: {
        jsv: "2.7.4",
        appKey: this.site.appKey,
        t,
        sign,
        api,
        v: this.site.version,
        type: "jsonp",
        dataType: "jsonp",
        callback: "mtopjsonp1",
        data: dataString
      },
      headers: this.cookieHeader ? { Cookie: this.cookieHeader } : {}
    });

    const payload = parseMtopPayload(response.data);
    if (retry && isMtopTokenError(payload)) {
      await this.refreshToken(api, baseData);
      return this.call(api, data, false);
    }

    return payload;
  }
}

async function crawlByMtop(site = MTOP_CN_SITE, options = {}) {
  const searchKeywords = options.searchKeywords || MTOP_SEARCH_KEYWORDS;
  const sourceLabel = options.sourceLabel || MTOP_RULE_SOURCE_LABEL;
  const ruleHost = options.ruleHost || "rulechannel.tmall.com";
  const isHk = site === MTOP_HK_SITE;

  const mtop = new MtopRuleClient(site);
  const metadata = [];

  for (let pageIndex = 1; pageIndex <= MAX_MTOP_LIST_PAGES; pageIndex += 1) {
    const payload = await mtop.call(MTOP_APIS.list, {
      pageIndex,
      pageSize: MTOP_PAGE_SIZE
    });

    if (!isMtopSuccess(payload)) {
      break;
    }

    const list = Array.isArray(payload?.data?.model) ? payload.data.model : [];
    if (!list.length) {
      break;
    }

    metadata.push(...list);
    if (list.length < MTOP_PAGE_SIZE) {
      break;
    }
  }

  for (const keyword of searchKeywords) {
    const payload = await mtop.call(MTOP_APIS.search, {
      pageIndex: 1,
      pageSize: 20,
      keyword
    });

    if (!isMtopSuccess(payload)) {
      continue;
    }

    const list = Array.isArray(payload?.data?.model) ? payload.data.model : [];
    metadata.push(...list);
  }

  const byRuleId = new Map();
  for (const item of metadata) {
    if (item?.ruleId && !byRuleId.has(item.ruleId)) {
      byRuleId.set(item.ruleId, item);
    }
  }

  const picked = [...byRuleId.values()].slice(0, MAX_DETAIL_FETCH);
  const details = await mapLimit(picked, MTOP_DETAIL_CONCURRENCY, async (item) => {
    const detailPayload = {
      ruleId: String(item.ruleId),
      language: null
    };
    if (isHk && item.lastCategoryId != null && item.lastCategoryId !== "") {
      detailPayload.lastCategoryId = String(item.lastCategoryId);
    }

    const payload = await mtop.call(MTOP_APIS.detail, detailPayload);
    if (!isMtopSuccess(payload) || !payload?.data?.model) {
      return null;
    }

    const model = payload.data.model;
    const content = htmlToText(model.ruleHtmlPcDetail || model.ruleAslContent || "");
    if (!content) {
      return null;
    }

    const publishedAt =
      parseDateTime(model.modifiedTime || item.modifiedTime) || new Date().toISOString();
    const cId = model.lastCategoryId ?? item.lastCategoryId ?? "";

    return {
      title: normalizeText(model.ruleTitle || item.ruleTitle || ""),
      url: buildRuleDetailUrl(model.ruleId || item.ruleId, cId, ruleHost),
      source: sourceLabel,
      publishedAt,
      content: content.slice(0, 12000),
      crawledAt: new Date().toISOString()
    };
  });

  return details.filter(Boolean);
}

function extractCandidates(html, sourceUrl) {
  const $ = cheerio.load(html);
  const result = [];

  $("a[href]").each((_, element) => {
    const title = normalizeText($(element).text());
    const href = $(element).attr("href") || "";
    const url = toAbsoluteUrl(sourceUrl, href);

    if (!title || title.length < 6 || !url) {
      return;
    }

    if (!hasRuleKeyword(title) && !hasRuleKeyword(url)) {
      return;
    }

    result.push({
      title,
      url,
      hintDate: extractDate(title)
    });
  });

  const deduped = new Map();
  for (const item of result) {
    if (!deduped.has(item.url)) {
      deduped.set(item.url, item);
    }
  }

  return [...deduped.values()].slice(0, MAX_LIST_PER_SOURCE);
}

function extractMainContent(html) {
  const $ = cheerio.load(html);
  $("script,style,noscript").remove();

  const candidates = [
    "article",
    "main",
    ".article",
    ".article-content",
    ".content",
    "#content",
    ".mod-article"
  ];

  let best = "";
  for (const selector of candidates) {
    const text = normalizeText($(selector).text());
    if (text.length > best.length) {
      best = text;
    }
  }

  if (!best) {
    best = normalizeText($("body").text());
  }

  return best.slice(0, 8000);
}

async function crawlHtmlDetail(candidate, sourceName) {
  try {
    const response = await pageClient.get(candidate.url);
    const content = extractMainContent(response.data);
    const publishedAt =
      extractDate(content) || candidate.hintDate || new Date().toISOString();

    if (!content || content.length < 60) {
      return null;
    }

    return {
      title: candidate.title,
      url: candidate.url,
      source: sourceName,
      publishedAt,
      content,
      crawledAt: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

async function crawlHtmlSource(source) {
  try {
    const response = await pageClient.get(source.url);
    const candidates = extractCandidates(response.data, source.url);
    const picked = candidates.slice(0, 20);

    const details = [];
    for (const candidate of picked) {
      const detail = await crawlHtmlDetail(candidate, source.name);
      if (detail) {
        details.push(detail);
      }
    }

    return details;
  } catch {
    return [];
  }
}

const HTML_SKIP_MESSAGE = "MTOP 已满足阈值，本次未执行网页抓取";

function manifestEntryById(id, manifest = CRAWL_SOURCE_MANIFEST) {
  return manifest.find((entry) => entry.id === id);
}

function dedupeRules(rules) {
  const deduped = new Map();
  for (const rule of rules) {
    const key = rule.url || `${rule.title}|${rule.publishedAt}`;
    if (!deduped.has(key)) {
      deduped.set(key, rule);
    }
  }
  return [...deduped.values()];
}

async function crawlAllSourcesForManifest({
  manifest,
  htmlSources,
  mtopId,
  mtopCrawl
}) {
  const report = [];
  const mtopEntry = manifestEntryById(mtopId, manifest);
  const mtopRules = await mtopCrawl();

  report.push({
    id: mtopId,
    label: mtopEntry?.label || mtopId,
    status: mtopRules.length > 0 ? "online" : "error",
    count: mtopRules.length,
    message: mtopRules.length === 0 ? "未获取到规则" : undefined
  });

  const skipHtml = mtopRules.length >= MTOP_HTML_SKIP_THRESHOLD;
  const htmlRules = [];

  for (const entry of manifest.filter((item) => item.type === "html")) {
    if (skipHtml) {
      report.push({
        id: entry.id,
        label: entry.label,
        status: "skipped",
        count: 0,
        message: HTML_SKIP_MESSAGE
      });
      continue;
    }

    const source = htmlSources.find((item) => item.url === entry.url);
    if (!source) {
      report.push({
        id: entry.id,
        label: entry.label,
        status: "error",
        count: 0,
        message: "HTML 源配置缺失"
      });
      continue;
    }

    const result = await crawlHtmlSource(source);
    htmlRules.push(...result);
    report.push({
      id: entry.id,
      label: entry.label,
      status: result.length > 0 ? "online" : "error",
      count: result.length,
      message: result.length === 0 ? "未获取到规则" : undefined
    });
  }

  const rules = skipHtml ? mtopRules : dedupeRules([...mtopRules, ...htmlRules]);
  return { rules, report };
}

export async function crawlAllSources(options = {}) {
  const platform = options.platform || "tmall";

  if (platform === "intl") {
    return crawlAllSourcesForManifest({
      manifest: CRAWL_SOURCE_MANIFEST_INTL,
      htmlSources: INTL_HTML_SOURCES,
      mtopId: "mtop-hk",
      mtopCrawl: () =>
        crawlByMtop(MTOP_HK_SITE, {
          searchKeywords: MTOP_SEARCH_KEYWORDS_INTL,
          sourceLabel: MTOP_HK_RULE_SOURCE_LABEL,
          ruleHost: "rule.tmall.hk"
        })
    });
  }

  return crawlAllSourcesForManifest({
    manifest: CRAWL_SOURCE_MANIFEST,
    htmlSources: TMALL_SOURCES,
    mtopId: "mtop",
    mtopCrawl: () =>
      crawlByMtop(MTOP_CN_SITE, {
        searchKeywords: MTOP_SEARCH_KEYWORDS,
        sourceLabel: MTOP_RULE_SOURCE_LABEL,
        ruleHost: "rulechannel.tmall.com"
      })
  });
}

/** 按 ruleId 拉取单条规则详情（供分类页引用来源监测使用） */
function modelToRuleDetail(model, { ruleId, fallbackUrl, origin = "mtop" }) {
  if (!model) {
    return null;
  }
  const content = htmlToText(model.ruleHtmlPcDetail || model.ruleAslContent || "");
  if (!content) {
    return null;
  }
  const publishedAt =
    parseDateTime(model.modifiedTime) || new Date().toISOString();
  const resolvedRuleId = String(model.ruleId || ruleId);
  const cId = model.lastCategoryId != null ? String(model.lastCategoryId) : "";
  return {
    ruleId: resolvedRuleId,
    cId,
    title: normalizeText(model.ruleTitle || ""),
    url:
      fallbackUrl ||
      buildRuleDetailUrl(
        resolvedRuleId,
        cId,
        origin.startsWith("mtop-hk") ? "rule.tmall.hk" : "rulechannel.tmall.com"
      ),
    publishedAt,
    content: content.slice(0, 12000),
    crawledAt: new Date().toISOString(),
    origin
  };
}

async function fetchRuleDetailViaMtop(site, { ruleId, lastCategoryId, fallbackUrl }) {
  const mtop = new MtopRuleClient(site);
  const detailPayload = {
    ruleId: String(ruleId),
    language: null
  };
  if (lastCategoryId) {
    detailPayload.lastCategoryId = String(lastCategoryId);
  }

  const payload = await mtop.call(MTOP_APIS.detail, detailPayload);
  if (isMtopSuccess(payload) && payload?.data?.model) {
    return modelToRuleDetail(payload.data.model, {
      ruleId,
      fallbackUrl,
      origin: site === MTOP_HK_SITE ? "mtop-hk" : "mtop"
    });
  }

  if (site === MTOP_HK_SITE) {
    const logPayload = await mtop.call(
      "mtop.alibaba.rulechannel.newrule.rulelog.detail",
      {
        historyId: String(ruleId),
        language: null
      }
    );
    if (isMtopSuccess(logPayload) && logPayload?.data?.model) {
      return modelToRuleDetail(logPayload.data.model, {
        ruleId,
        fallbackUrl,
        origin: "mtop-hk-log"
      });
    }
  }

  return null;
}

export async function fetchRuleDetailByRuleId(ruleId, options = {}) {
  if (!ruleId) {
    return null;
  }

  const lastCategoryId = options.cId || options.lastCategoryId || "";
  const site = options.site === "hk" ? MTOP_HK_SITE : MTOP_CN_SITE;

  return fetchRuleDetailViaMtop(site, {
    ruleId,
    lastCategoryId,
    fallbackUrl: options.url
  });
}

/** curated 来源：自动识别 rule.tmall.hk 并使用国际站 MTOP（buCode 316 + lastCategoryId） */
export async function fetchRuleDetailForCuratedSource(source) {
  if (!source?.ruleId) {
    return null;
  }

  const isHk = /rule\.tmall\.hk/i.test(String(source.url || ""));
  const lastCategoryId = source.cId || source.lastCategoryId || "";

  if (isHk) {
    const hk = await fetchRuleDetailViaMtop(MTOP_HK_SITE, {
      ruleId: source.ruleId,
      lastCategoryId,
      fallbackUrl: source.url
    });
    if (hk) {
      return hk;
    }
  }

  const cn = await fetchRuleDetailViaMtop(MTOP_CN_SITE, {
    ruleId: source.ruleId,
    lastCategoryId,
    fallbackUrl: source.url
  });
  if (cn) {
    return cn;
  }

  return fetchRuleDetailByRuleId(source.ruleId, {
    site: isHk ? "hk" : "cn",
    cId: lastCategoryId,
    url: source.url
  });
}
