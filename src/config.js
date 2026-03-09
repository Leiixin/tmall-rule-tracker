export const TMALL_SOURCES = [
  {
    name: "天猫规则频道",
    url: "https://rulechannel.tmall.com/"
  },
  {
    name: "天猫规则中心",
    url: "https://rule.tmall.com/"
  }
];

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
