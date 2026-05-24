/**
 * MTOP rule detail fetch using Node built-in fetch (no axios/cheerio).
 * For audit/offline scripts when node_modules is not installed.
 */
import { createHash } from "node:crypto";

import { MTOP_APIS, MTOP_CONFIG } from "../config.js";
import { buildRuleDetailUrl } from "../utils/ruleDetailUrl.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function htmlToText(html) {
  return normalizeText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
  );
}

function parseMtopPayload(text) {
  const raw = String(text || "").trim();
  const jsonText = raw
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

function parseDateTime(value) {
  if (!value) {
    return "";
  }
  const d = new Date(String(value).replace(/\//g, "-"));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

class MtopLiteClient {
  constructor() {
    this.cookieHeader = "";
    this.token = "";
  }

  baseData(data = {}) {
    return {
      identityCode: MTOP_CONFIG.identityCode,
      terminal: MTOP_CONFIG.terminal,
      buCode: MTOP_CONFIG.buCode,
      ...data
    };
  }

  endpoint(api) {
    return `https://h5api.m.taobao.com/h5/${api}/${MTOP_CONFIG.version}/`;
  }

  buildUrl(api, params) {
    const u = new URL(this.endpoint(api));
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  async httpGet(url) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: "https://rulechannel.tmall.com/",
        Origin: "https://rulechannel.tmall.com",
        Cookie: this.cookieHeader
      }
    });
    const text = await res.text();
    const setCookie = res.headers.getSetCookie?.() || [];
    const cookies = setCookie.map((item) => item.split(";")[0]);
    if (cookies.length) {
      this.cookieHeader = cookies.join("; ");
      const tkEntry = cookies.find((item) => item.startsWith("_m_h5_tk=")) || "";
      const tkRaw = tkEntry.split("=")[1] || "";
      this.token = tkRaw.split("_")[0] || "";
    }
    return text;
  }

  async refreshToken(api, baseData) {
    const dataString = JSON.stringify(baseData);
    const url = this.buildUrl(api, {
      jsv: "2.7.4",
      appKey: MTOP_CONFIG.appKey,
      t: Date.now().toString(),
      sign: "",
      api,
      v: MTOP_CONFIG.version,
      type: "jsonp",
      dataType: "jsonp",
      callback: "mtopjsonp1",
      data: dataString
    });
    await this.httpGet(url);
  }

  async call(api, data = {}, retry = true) {
    const baseData = this.baseData(data);
    const dataString = JSON.stringify(baseData);

    if (!this.token || !this.cookieHeader) {
      await this.refreshToken(api, baseData);
    }

    const t = Date.now().toString();
    const sign = md5(`${this.token}&${t}&${MTOP_CONFIG.appKey}&${dataString}`);
    const url = this.buildUrl(api, {
      jsv: "2.7.4",
      appKey: MTOP_CONFIG.appKey,
      t,
      sign,
      api,
      v: MTOP_CONFIG.version,
      type: "jsonp",
      dataType: "jsonp",
      callback: "mtopjsonp1",
      data: dataString
    });

    const text = await this.httpGet(url);
    const payload = parseMtopPayload(text);
    if (!payload) {
      return null;
    }

    const ret = Array.isArray(payload?.ret) ? payload.ret.join("|") : "";
    if (
      retry &&
      (ret.includes("FAIL_SYS_TOKEN") || ret.includes("FAIL_SYS_ILLEGAL"))
    ) {
      await this.refreshToken(api, baseData);
      return this.call(api, data, false);
    }

    return payload;
  }
}

export async function fetchRuleDetailByRuleIdLite(ruleId) {
  if (!ruleId) {
    return null;
  }

  const mtop = new MtopLiteClient();
  const payload = await mtop.call(MTOP_APIS.detail, { ruleId: String(ruleId) });
  if (!isMtopSuccess(payload) || !payload?.data?.model) {
    return null;
  }

  const model = payload.data.model;
  const content = htmlToText(model.ruleHtmlPcDetail || model.ruleAslContent || "");
  if (!content) {
    return null;
  }

  return {
    ruleId: String(model.ruleId || ruleId),
    cId: model.lastCategoryId != null ? String(model.lastCategoryId) : "",
    title: normalizeText(model.ruleTitle || ""),
    url: buildRuleDetailUrl(model.ruleId || ruleId, model.lastCategoryId),
    publishedAt:
      parseDateTime(model.modifiedTime) || new Date().toISOString(),
    content: content.slice(0, 12000),
    crawledAt: new Date().toISOString()
  };
}
