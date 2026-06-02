/** 首页抓取源芯片 + 爬虫分项报告（天猫主站） */
export const CRAWL_SOURCE_MANIFEST = [
  { id: "mtop", label: "天猫规则中心（MTOP）", type: "mtop" },
  {
    id: "rulechannel",
    label: "天猫规则频道（网页）",
    name: "天猫规则频道",
    type: "html",
    url: "https://rulechannel.tmall.com/"
  },
  {
    id: "rule_tmall",
    label: "天猫规则中心（网页）",
    name: "天猫规则中心",
    type: "html",
    url: "https://rule.tmall.com/"
  }
];

/** 天猫国际 rule.tmall.hk */
export const CRAWL_SOURCE_MANIFEST_INTL = [
  { id: "mtop-hk", label: "天猫国际（rule.tmall.hk / MTOP）", type: "mtop" },
  {
    id: "mtop-hk-publicity",
    label: "天猫国际（规则公示 / MTOP）",
    type: "mtop"
  },
  {
    id: "rule_tmall_hk",
    label: "天猫国际规则中心（网页）",
    name: "天猫国际规则中心",
    type: "html",
    url: "https://rule.tmall.hk/"
  }
];

export const MTOP_RULE_SOURCE_LABEL = CRAWL_SOURCE_MANIFEST.find((s) => s.id === "mtop").label;
export const MTOP_HK_RULE_SOURCE_LABEL = CRAWL_SOURCE_MANIFEST_INTL.find(
  (s) => s.id === "mtop-hk"
).label;

export const MTOP_HTML_SKIP_THRESHOLD = 20;

export const TMALL_SOURCES = CRAWL_SOURCE_MANIFEST.filter((s) => s.type === "html").map((s) => ({
  name: s.name,
  url: s.url
}));

export const INTL_HTML_SOURCES = CRAWL_SOURCE_MANIFEST_INTL.filter((s) => s.type === "html").map(
  (s) => ({
    name: s.name,
    url: s.url
  })
);

export const RULE_KEYWORDS = [
  "规则",
  "公告",
  "发货",
  "体验分",
  "违约",
  "违规",
  "处罚",
  "时效",
  "生效"
];

export const CATEGORY_KEYWORDS = {
  effectivePeriod: ["生效", "有效期", "执行时间", "适用时间", "起止时间", "实施"],
  shopExperienceScore: ["店铺体验分", "体验分", "综合体验", "服务体验", "商品体验", "物流体验"],
  shippingTimeliness: ["发货时效", "发货时间", "揽收时效", "48小时发货", "24小时发货", "延迟发货"],
  shippingViolationPenalty: ["发货违规", "处罚", "违约金", "赔付", "扣分", "违规处理", "申诉"]
};

export const CATEGORY_LABELS = {
  effectivePeriod: "效期",
  shopExperienceScore: "店铺体验分",
  shippingTimeliness: "发货时效",
  shippingViolationPenalty: "发货违规及处罚"
};

/** 天猫国际规则分类关键词（gh-crawl scraped 桶 + classifier tags） */
export const INTL_CATEGORY_KEYWORDS = {
  intl_expiry: ["效期", "临期", "保质期", "到期", "禁售", "过期"],
  intl_logistics: ["物流", "发货", "揽收", "时效", "轨迹", "保税", "直邮", "跨境"],
  intl_qual: ["资质", "入驻", "品牌", "授权", "招商", "商标", "许可证"],
  intl_penalty: ["违规", "处罚", "违约金", "赔付", "扣分", "滥发", "清退", "市场管理"]
};

export const INTL_CATEGORY_LABELS = {
  intl_expiry: "效期与效期管理",
  intl_logistics: "跨境物流与发货",
  intl_qual: "资质与品牌",
  intl_penalty: "违规与处罚"
};

export const MAX_LIST_PER_SOURCE = 30;
export const MAX_DETAIL_FETCH = 120;
export const CRON_EXPRESSION = "0 9 * * *";

export const MTOP_CONFIG = {
  appKey: "12574478",
  version: "1.0",
  identityCode: "2",
  buCode: 11,
  terminal: "PC"
};

/** rule.tmall.hk GlobalConfig: buCode 316, identityCode/requestCode 1 */
export const MTOP_HK_CONFIG = {
  appKey: MTOP_CONFIG.appKey,
  version: MTOP_CONFIG.version,
  identityCode: "1",
  buCode: 316,
  terminal: "PC",
  referer: "https://rule.tmall.hk/",
  origin: "https://rule.tmall.hk"
};

export const MTOP_CN_SITE = {
  ...MTOP_CONFIG,
  referer: "https://rulechannel.tmall.com/",
  origin: "https://rulechannel.tmall.com"
};

export const MTOP_HK_SITE = {
  ...MTOP_HK_CONFIG,
  referer: MTOP_HK_CONFIG.referer,
  origin: MTOP_HK_CONFIG.origin
};

export const MTOP_APIS = {
  latest: "mtop.alibaba.rulechannel.newrule.rule.latest",
  list: "mtop.alibaba.rulechannel.newrule.rule.list",
  search: "mtop.alibaba.rulechannel.newrule.rule.search",
  detail: "mtop.alibaba.rulechannel.newrule.rule.detail"
};

export const MAX_MTOP_LIST_PAGES = 8;
export const MTOP_PAGE_SIZE = 20;
export const MTOP_DETAIL_CONCURRENCY = 4;
export const MTOP_SEARCH_KEYWORDS = ["发货", "时效", "体验分", "违规", "处罚"];

export const MTOP_SEARCH_KEYWORDS_INTL = [
  "天猫国际",
  "效期",
  "临期",
  "跨境",
  "资质",
  "物流",
  "违规",
  "发货",
  "公示"
];

/** rule.tmall.hk 规则公示栏（#/rules?cId=636） */
export const INTL_PUBLICITY_CATEGORY_ID = "636";
export const INTL_PUBLICITY_SOURCE_SUFFIX = "（规则公示）";
export const MAX_INTL_PUBLICITY_LIST_PAGES = 10;
export const MAX_INTL_PUBLICITY_DETAIL_FETCH = 50;

/** 抖音电商规则中心 school.jinritemai.com */
export const CRAWL_SOURCE_MANIFEST_DOUYIN = [
  { id: "douyin-bff", label: "抖音电商规则中心", type: "douyin" },
  {
    id: "douyin_html",
    label: "规则中心网页（兜底）",
    name: "抖音电商规则中心",
    type: "html",
    url: "https://school.jinritemai.com/doudian/web/rules"
  }
];

export const DOUYIN_RULE_SOURCE_LABEL = CRAWL_SOURCE_MANIFEST_DOUYIN.find(
  (s) => s.id === "douyin-bff"
).label;

export const DOUYIN_HTML_SOURCES = CRAWL_SOURCE_MANIFEST_DOUYIN.filter((s) => s.type === "html").map(
  (s) => ({
    name: s.name,
    url: s.url
  })
);

export const DOUYIN_GRAPH_ID = 312;
export const DOUYIN_ROOT_NODE_ID = 7236;

export const DOUYIN_CATEGORY_KEYWORDS = {
  shelf: ["效期", "临期", "保质期", "过期", "禁售", "新鲜日期", "盲盒", "商品信息", "到期"],
  score: ["体验分", "商家体验分", "商品体验", "物流体验", "服务体验", "品退", "差评", "综合评分"],
  ship: ["发货", "揽收", "物流时效", "轨迹", "售后", "退款", "消极服务", "飞鸽", "配送"],
  penalty: ["违规", "处罚", "违约金", "扣分", "虚假交易", "价格违规", "清退", "封禁", "赔付"]
};

export const DOUYIN_CATEGORY_LABELS = {
  shelf: "商品效期要求",
  score: "店铺真实体验分",
  ship: "发货时效",
  penalty: "发货违规及处罚"
};

export const DOUYIN_SEARCH_KEYWORDS = ["发货", "违规", "入驻", "直播", "售后", "资质", "创作者"];

export const MAX_DOUYIN_PAGE_SIZE = 50;
export const MAX_DOUYIN_CATALOG_PAGES = 8;
/** @deprecated 与栏目 11688 rule/list 同源，已由 MAX_DOUYIN_DYNAMICS_LIST_PAGES 取代 */
export const MAX_DOUYIN_ANNOUNCEMENT_PAGES = 0;

/** 规则动态栏目 /doudian/web/rules/11688 */
export const DOUYIN_DYNAMICS_SECTION_ID = "11688";
export const DOUYIN_DYNAMICS_SECTION_URL = `https://school.jinritemai.com/doudian/web/rules/${DOUYIN_DYNAMICS_SECTION_ID}?tabKey=rules`;
export const MAX_DOUYIN_DYNAMICS_LIST_PAGES = 10;
export const DOUYIN_DYNAMICS_LIST_PARAMS = {
  rule_type: 0,
  direction: 2
};
export const DOUYIN_DYNAMICS_SOURCE_SUFFIX = "（规则动态）";

export const PLATFORM_CRAWL_MANIFESTS = {
  tmall: CRAWL_SOURCE_MANIFEST,
  intl: CRAWL_SOURCE_MANIFEST_INTL,
  douyin: CRAWL_SOURCE_MANIFEST_DOUYIN
};
