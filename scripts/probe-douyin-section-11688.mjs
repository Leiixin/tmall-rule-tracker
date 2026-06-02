/**
 * 探测 /doudian/web/rules/11688 栏目页背后的列表 API（无需登录）
 */
const SECTION_URL =
  "https://school.jinritemai.com/doudian/web/rules/11688?tabKey=rules";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: SECTION_URL,
  Origin: "https://school.jinritemai.com"
};

async function getJson(path, params = {}) {
  const url = new URL(path, "https://school.jinritemai.com");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  const r = await fetch(url.toString(), { headers });
  const text = await r.text();
  if (!r.ok) {
    return { ok: false, status: r.status, preview: text.slice(0, 80) };
  }
  try {
    const j = JSON.parse(text);
    return { ok: j.code === 0, code: j.code, msg: j.msg, data: j.data };
  } catch {
    return { ok: false, preview: text.slice(0, 80) };
  }
}

function summarizeList(data, label) {
  const infos = data?.rule_infos || data?.articles || [];
  const total = data?.total ?? infos.length;
  const sample = infos.slice(0, 3).map((x) => ({
    id: x.knowledge_id || x.id || x.article_id,
    title: (x.title || x.name || "").slice(0, 50)
  }));
  return { label, total, count: infos.length, sample };
}

const results = [];

for (const [ruleType, direction, ruleStatus] of [
  [0, 2, undefined],
  [0, undefined, undefined],
  [0, 2, 201],
  [1, 2, undefined],
  [2, 2, undefined]
]) {
  const params = { rule_type: ruleType, page: 1, page_size: 50 };
  if (direction !== undefined) params.direction = direction;
  if (ruleStatus !== undefined) params.rule_status = ruleStatus;
  const res = await getJson("/api/eschool/v1/rule/list", params);
  if (res.ok) {
    results.push({
      api: "rule/list",
      params,
      ...summarizeList(res.data, `rule_type=${ruleType}`)
    });
  }
}

const lib = await getJson("/api/eschool/v2/library/article/list", {
  node_id: 11688,
  page: 1,
  page_size: 50
});
if (lib.ok) {
  results.push({
    api: "library/article/list",
    params: { node_id: 11688, page: 1, page_size: 50 },
    ...summarizeList(lib.data, "node_id=11688")
  });
}

const baseline = await getJson("/api/eschool/v1/rule/list", {
  rule_type: 0,
  page: 1,
  page_size: 50,
  direction: 2
});
const defaultReferer = { ...headers, Referer: "https://school.jinritemai.com/doudian/web/rules" };
const url = new URL("/api/eschool/v1/rule/list", "https://school.jinritemai.com");
url.searchParams.set("rule_type", "0");
url.searchParams.set("page", "1");
url.searchParams.set("page_size", "50");
url.searchParams.set("direction", "2");
const r2 = await fetch(url.toString(), { headers: defaultReferer });
const j2 = await r2.json();

const winning =
  results.find((x) => x.api === "rule/list" && x.total > 0) || results[0];

console.log(
  JSON.stringify(
    {
      sectionUrl: SECTION_URL,
      variants: results,
      refererCompare: {
        section11688: baseline.ok ? summarizeList(baseline.data, "section referer") : baseline,
        defaultRules: j2.code === 0 ? summarizeList(j2.data, "default referer") : j2
      },
      winning: {
        api: winning?.api,
        listParams: winning?.params || { rule_type: 0, direction: 2 },
        total: winning?.total,
        sample: winning?.sample
      }
    },
    null,
    2
  )
);
