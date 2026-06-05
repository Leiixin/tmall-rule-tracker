/**
 * 生成抖音分类页 curated 数据（对齐天猫 shelf/score/ship/penalty 四类）
 * 运行: node scripts/build-douyin-curated-data.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, "data", "douyin");
const publicDir = path.join(repoRoot, "public", "data", "douyin");

function ruleUrl(slug) {
  return `https://school.jinritemai.com/doudian/web/rules/${slug}`;
}

function articleUrl(slug) {
  return `https://school.jinritemai.com/doudian/web/article/${slug}`;
}

/** 商品效期要求唯一来源（规则众议院文章页） */
const SHELF_ARTICLE_URL = articleUrl("aJk964FFQKKZ");

const SCORE_ARTICLE_URL = articleUrl("103956");

/** 发货时效总纲 + penalty 框架卡片 */
const SHIP_PENALTY_ARTICLE_URL = articleUrl("101706");

/** 101706 第四章引用的违规实施细则（article 内嵌链接） */
const PENALTY_DETAIL_SOURCES = [
  {
    id: "dy-rule-aHwH9wK4JUHQ",
    slug: "aHwH9wK4JUHQ",
    label: "【商家-违规发货违规处理手段】实施细则",
    cardIds: []
  },
  {
    id: "dy-rule-aHwH9wK4Je2N",
    slug: "aHwH9wK4Je2N",
    label: "【商家-发货超时】实施细则",
    cardIds: ["penalty:0"]
  },
  {
    id: "dy-rule-aHwHGWzbmk88",
    slug: "aHwHGWzbmk88",
    label: "【商家-缺货/无货】实施细则",
    cardIds: ["penalty:1"]
  },
  {
    id: "dy-rule-aHwHroCPheig",
    slug: "aHwHroCPheig",
    label: "【商家-物流轨迹超时】实施细则",
    cardIds: ["penalty:2"]
  },
  {
    id: "dy-rule-aHzmeN9E9dBF",
    slug: "aHzmeN9E9dBF",
    label: "【商家-物流轨迹异常】实施细则",
    cardIds: ["penalty:3"]
  },
  {
    id: "dy-rule-aHwH9wK4JyWJ",
    slug: "aHwH9wK4JyWJ",
    label: "【商家-欺诈发货】实施细则",
    cardIds: ["penalty:4"]
  }
];

const timestamp = new Date().toISOString();

const curatedSources = {
  version: 1,
  updatedAt: timestamp,
  repoEditUrl:
    "https://github.com/Leiixin/tmall-rule-tracker/edit/main/data/douyin/curated-sources.json",
  sources: [
    {
      id: "dy-rule-aJk964FFQKKZ",
      slug: "aJk964FFQKKZ",
      platform: "douyin",
      url: SHELF_ARTICLE_URL,
      label: "商品保质期管理和宣传规范",
      categories: ["shelf"],
      cardIds: ["shelf:0", "shelf:1", "shelf:2", "shelf:3"],
      ruleTitle: "关于修订《商品保质期管理和宣传规范》的公示通知"
    },
    {
      id: "dy-rule-gehu-publish",
      slug: "108445",
      platform: "douyin",
      ruleId: "108445",
      url: articleUrl("108445"),
      label: "【个护家清】商品发布细则",
      categories: ["shelf"],
      cardIds: ["shelf:2"],
      ruleTitle: "【个护家清】商品发布细则"
    },
    {
      id: "dy-rule-101936",
      slug: "101936",
      platform: "douyin",
      ruleId: "101936",
      url: ruleUrl("101936"),
      label: "商家【虚假宣传】细则",
      categories: ["shelf"],
      cardIds: ["shelf:3"],
      ruleTitle: "商家【虚假宣传】细则"
    },
    {
      id: "dy-rule-creator-style-fake",
      slug: "aJaqcnLx78cq",
      platform: "douyin",
      url: articleUrl("aJaqcnLx78cq"),
      label: "创作者【虚假宣传:款式/颜色等商品信息不一致】实施细则",
      categories: ["shelf"],
      cardIds: ["shelf:3"],
      ruleTitle: "「虚假宣传：款式/颜色等商品信息不一致」实施细则"
    },
    {
      id: "dy-rule-103956",
      slug: "103956",
      platform: "douyin",
      ruleId: "103956",
      url: SCORE_ARTICLE_URL,
      label: "商家体验分考核",
      categories: ["score"],
      cardIds: ["score:0", "score:1", "score:2"],
      ruleTitle: "商家体验分规范"
    },
    {
      id: "dy-rule-101706",
      slug: "101706",
      platform: "douyin",
      ruleId: "101706",
      url: SHIP_PENALTY_ARTICLE_URL,
      label: "商家发货行为管理规则",
      categories: ["ship", "penalty"],
      cardIds: ["ship:0", "ship:1", "ship:2", "penalty:5", "penalty:6"],
      ruleTitle: "商家发货行为管理规则",
      manualTextPath: "data/douyin/rule-text/rule-101706.txt"
    },
    ...PENALTY_DETAIL_SOURCES.map((s) => ({
      id: s.id,
      slug: s.slug,
      platform: "douyin",
      url: articleUrl(s.slug),
      label: s.label,
      categories: ["penalty"],
      cardIds: s.cardIds,
      ruleTitle: s.label,
      manualTextPath: `data/douyin/rule-text/rule-${s.slug}.txt`
    }))
  ]
};

const curatedCards = {
  version: 1,
  updatedAt: timestamp,
  autoPublishVersion: 1,
  shelf: {
    tag: "SHELF-LIFE RULES",
    title: "商品效期要求",
    desc:
      "抖音在售商品保质期、临期标注与禁售标准，唯一依据《商品保质期管理和宣传规范》（公示期 2026-05-26～2026-06-02，预计 2026-06-02 生效）。",
    cards: [
      {
        title: "保质期定义与计算规则",
        severity: "info",
        severityText: "通知",
        date: "2026-06-02",
        tags: ["保质期", "换算规则"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li>保质期指在既定贮存环境下保持品质的期限。</li><li>保质期以月计，按 <span class=\"num\">1个月=30天</span> 换算；以年计，按 <span class=\"num\">1年=365天</span> 换算。</li><li>临期天数计算向上取整。</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:0"
      },
      {
        title: "临期商品标注与展示要求",
        severity: "critical",
        severityText: "强制",
        date: "2026-06-02",
        tags: ["临期标注", "展示要求"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li>临期商品须在标题写明「临期商品」字样。</li><li>详情页最上方显著标示「此商品为临近保质期商品」。</li><li>临期起算时间以商家发货后物流系统揽收时间为准。</li><li>对于已标明「临期」的商品，商家应保证消费者收到的商品时不得为过期商品（因消费者自身原因导致的收货延迟除外）。</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:1"
      },
      {
        title: "临期商品分级标准（按保质期）",
        severity: "warning",
        severityText: "警告",
        date: "2026-06-02",
        tags: ["临期天数", "分级标准"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li>保质期≥365天：剩余≤ <span class=\"num\">45天</span> 为临期。</li><li>180天≤保质期&lt;365天：剩余≤ <span class=\"num\">30天</span> 为临期。</li><li>90天≤保质期&lt;180天：剩余≤ <span class=\"num\">20天</span> 为临期。</li><li>30天≤保质期&lt;90天：剩余≤ <span class=\"num\">10天</span> 为临期。</li><li>15天≤保质期&lt;30天：剩余≤ <span class=\"num\">5天</span> 为临期。</li><li>保质期&lt;15天：剩余≤ <span class=\"num\">4天</span> 为临期。</li><li>个护家清行业保质期临期商品标准详见 <a href=\"https://school.jinritemai.com/doudian/web/article/108445\" target=\"_blank\" rel=\"noopener\">【个护家清】商品发布细则</a>。</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:2"
      },
      {
        title: "禁售过期商品及违规处理",
        severity: "critical",
        severityText: "强制",
        date: "2026-06-02",
        tags: ["禁售", "过期商品", "违规处理", "酒类", "新鲜日期"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li>平台禁止销售过期商品。</li><li>出售已过期商品，依据 <a href=\"https://school.jinritemai.com/doudian/web/article/ajtm8pqejf51\" target=\"_blank\" rel=\"noopener\">【发布平台禁止商品/信息】细则</a>、<a href=\"https://school.jinritemai.com/doudian/web/rules/101805\" target=\"_blank\" rel=\"noopener\">【发布法规禁止商品/信息】细则</a> 处理。</li><li>包装出现篡改、手写、模糊保质期信息标示，或中英文保质期信息不一致，或内外包装生产日期/保质期不一致等，依据 <a href=\"https://school.jinritemai.com/doudian/web/article/aJHXGrf78jvz\" target=\"_blank\" rel=\"noopener\">商家【商品标识标志不合格】细则</a> 处理。</li><li>临期商品未按规范在标题与详情页标注临期特性，依据 <a href=\"https://school.jinritemai.com/doudian/web/article/aJCmA2QwDbES\" target=\"_blank\" rel=\"noopener\">商家【关键信息不明确】细则</a> 处理。</li><li>宣传酒类「新鲜日期」时，用户签收日期与生产日期的时间差不得超过商品保质期的 <span class=\"num\">1/3</span>。</li><li>若商家/创作者宣传酒类商品为「新鲜日期」，但未按 3.7 条规范要求宣传，平台将依据 <a href=\"https://school.jinritemai.com/doudian/web/rules/101936\" target=\"_blank\" rel=\"noopener\">商家【虚假宣传】细则</a>、<a href=\"https://school.jinritemai.com/doudian/web/article/aJaqcnLx78cq\" target=\"_blank\" rel=\"noopener\">创作者【虚假宣传:款式/颜色等商品信息不一致】实施细则</a> 处理。</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:3"
      }
    ]
  },
  score: {
    tag: "EXPERIENCE SCORE",
    title: "店铺真实体验分",
    desc:
      "商家体验分考核与应用场景，依据《商家体验分规范》（2026-05-07 修订生效），覆盖商品、物流、服务三大维度。",
    cards: [
      {
        title: "商家体验分定义与阶段",
        severity: "critical",
        severityText: "强制",
        date: "2026-05-07",
        tags: ["体验分", "考核"],
        link: ruleUrl("103956"),
        body: "<ul><li>体验分反映店铺 <span class=\"highlight\">商品、物流、服务</span> 综合服务能力</li><li><span class=\"highlight\">成长阶段</span>：近30天有效支付订单 &lt; <span class=\"num\">30</span> 单，出分后默认 <span class=\"num\">70</span> 分</li><li><span class=\"highlight\">正式阶段</span>：近30天有效支付订单 ≥ <span class=\"num\">30</span> 单，百分制 <span class=\"num\">50～100</span> 分</li><li>来源：《商家体验分规范》2.1～2.3</li></ul>",
        sourceId: "dy-rule-103956",
        cardId: "score:0"
      },
      {
        title: "正式阶段三维考核指标",
        severity: "critical",
        severityText: "强制",
        date: "2026-05-07",
        tags: ["商品体验", "物流", "服务"],
        link: ruleUrl("103956"),
        body: "<ul><li><span class=\"highlight\">商品体验</span>：商品综合评分、商品品质退货率</li><li><span class=\"highlight\">物流体验</span>：揽收时长、运单配送时效达成率、发货物流品退率</li><li><span class=\"highlight\">服务体验</span>：售后处理时长达成率、飞鸽人工平均响应时长</li><li>消极服务/刷单刷评等行为可 <span class=\"highlight\">差行为扣分</span>（单次最高扣 <span class=\"num\">15</span> 分）</li></ul>",
        sourceId: "dy-rule-103956",
        cardId: "score:1"
      },
      {
        title: "体验分应用场景",
        severity: "warning",
        severityText: "参考",
        date: "2026-05-07",
        tags: ["千川", "精选联盟"],
        link: ruleUrl("103956"),
        body: "<ul><li>体验分低于管控要求将 <span class=\"highlight\">禁止千川投放</span></li><li>影响 <span class=\"highlight\">平台营销活动提报</span> 与 <span class=\"highlight\">精选联盟准入</span></li><li>正式阶段分数以五分制星级向消费者展示</li><li>来源：《商家体验分规范》第四章</li></ul>",
        sourceId: "dy-rule-103956",
        cardId: "score:2"
      }
    ]
  },
  ship: {
    tag: "SHIPPING TIMELINE",
    title: "发货时效",
    desc:
      "发货承诺、发货时间认定与各类发货时效要求，依据《商家发货行为管理规则》（2025-09-29 修订生效）。",
    cards: [
      {
        title: "发货时效类型与承诺",
        severity: "critical",
        severityText: "强制",
        date: "2025-09-29",
        tags: ["极速发货", "次日发货"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li><span class=\"highlight\">极速/当日发货</span>：16:00前支付订单当日23:59:59前发货；16:00后支付订单次日23:59:59前发货</li><li><span class=\"highlight\">次日发货</span>：支付成功后次日23:59:59前发货</li><li>商家自主设置时效的，须在承诺时间内发货</li><li>多渠道承诺不一致时，以<span class=\"highlight\">有利于消费者的最短时效</span>为准</li><li>来源：《商家发货行为管理规则》第三章、附则表</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "ship:0"
      },
      {
        title: "发货时间如何认定",
        severity: "warning",
        severityText: "参考",
        date: "2025-09-29",
        tags: ["揽收", "发货"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li>有物流回传：以物流公司<span class=\"highlight\">揽收记录</span>时间为准（如「已揽收/揽件」）</li><li>无物流回传：以商家后台点击发货时间为准；若底单显示更晚发货，取更晚时间</li><li>协商工具另行约定发货时间的，以双方约定为准</li><li>来源：《商家发货行为管理规则》2.2</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "ship:1"
      },
      {
        title: "特殊场景发货要求",
        severity: "warning",
        severityText: "参考",
        date: "2025-09-29",
        tags: ["QIC", "蟹卡"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li><span class=\"highlight\">蟹卡类目</span>：消费者兑换实物时须按所选邮寄日期发货</li><li><span class=\"highlight\">QIC送仓</span>：普通商品支付后48小时内送仓/揽收；定制预售类在承诺时效前送仓</li><li>平台大促及特定节假日发货时效以平台通知或公告为准</li><li>来源：《商家发货行为管理规则》1.2、3.2、附则表</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "ship:2"
      }
    ]
  },
  penalty: {
    tag: "VIOLATIONS & PENALTIES",
    title: "发货违规及处罚",
    desc:
      "总纲《商家发货行为管理规则》及发货超时、缺货/无货、物流轨迹超时/异常、欺诈发货等实施细则；引用来源与卡片均对应 article 正文链接（2025-09-29 修订生效）。",
    cards: [
      {
        title: "发货超时：订单扣罚与店铺处置",
        severity: "critical",
        severityText: "强制",
        date: "2025-09-29",
        tags: ["发货超时", "扣罚"],
        link: articleUrl("aHwH9wK4Je2N"),
        body: "<ul><li><span class=\"highlight\">定义</span>：未在承诺发货时效内发货；揽收时间以物流回传或商家发货操作认定</li><li>承诺≤<span class=\"num\">48</span>小时：超时<span class=\"num\">48</span>小时内扣实付 <span class=\"num\">1%</span>（最低 <span class=\"num\">2</span> 元，最高 <span class=\"num\">50</span> 元）；超时<span class=\"num\">48</span>小时以上按缺货/无货处理</li><li>承诺 <span class=\"num\">48</span>～<span class=\"num\">240</span> 小时：超时<span class=\"num\">48</span>小时内 <span class=\"num\">1%</span>，超时<span class=\"num\">48</span>小时以上 <span class=\"num\">3%</span></li><li>情节严重：商品封禁 <span class=\"num\">3</span> 天、冻结货款 <span class=\"num\">3</span> 天（超时订单结算金额 <span class=\"num\">2</span> 倍，最低 <span class=\"num\">1000</span> 元）；特别严重可封禁 <span class=\"num\">7</span> 天、限制成交、冻结全部货款</li><li>来源：《【商家-发货超时】实施细则》</li></ul>",
        sourceId: "dy-rule-aHwH9wK4Je2N",
        cardId: "penalty:0"
      },
      {
        title: "缺货/无货：认定与扣罚",
        severity: "critical",
        severityText: "强制",
        date: "2025-09-29",
        tags: ["缺货", "无货"],
        link: articleUrl("aHwHGWzbmk88"),
        body: "<ul><li><span class=\"highlight\">认定</span>：承认缺货/拒发、联系不上、其它发货违规后仍未发货；发货超时 <span class=\"num\">48</span> 小时仍未发货等</li><li>可与发货超时扣罚<span class=\"highlight\">同时发起</span>；扣罚最高不超过 <span class=\"num\">1000</span> 元/单</li><li>承诺≤<span class=\"num\">48</span>小时：实付 <span class=\"num\">1%</span>（最低 <span class=\"num\">2</span> 元，最高 <span class=\"num\">50</span> 元）；<span class=\"num\">48</span>～<span class=\"num\">240</span> 小时：<span class=\"num\">3%</span>；&gt;<span class=\"num\">240</span> 小时：<span class=\"num\">5%</span></li><li>自然年累计：可冻结货款、限制预售/上新、店铺限单；<span class=\"num\">6</span> 次及以上可限制成交、冻结近 <span class=\"num\">7</span> 天结算货款 <span class=\"num\">2</span> 倍（最低 <span class=\"num\">1000</span> 元）</li><li>来源：《【商家-缺货/无货】实施细则》</li></ul>",
        sourceId: "dy-rule-aHwHGWzbmk88",
        cardId: "penalty:1"
      },
      {
        title: "物流轨迹超时：揽收与分拨",
        severity: "critical",
        severityText: "处罚",
        date: "2025-09-29",
        tags: ["物流轨迹", "揽收"],
        link: articleUrl("aHwHroCPheig"),
        body: "<ul><li><span class=\"highlight\">揽收超时</span>：上传单号后 <span class=\"num\">24</span> 小时无揽收记录</li><li><span class=\"highlight\">发运超时</span>：首条揽收后 <span class=\"num\">24</span> 小时无分拨中心轨迹更新</li><li>赔付：承诺发货≤<span class=\"num\">48</span>小时订单实付 <span class=\"num\">1%</span>（最低 <span class=\"num\">3</span> 元，最高 <span class=\"num\">30</span> 元）；&gt;<span class=\"num\">48</span>小时为 <span class=\"num\">5%</span>（最低 <span class=\"num\">5</span> 元，最高 <span class=\"num\">50</span> 元）</li><li>同省轨迹节点超时：一般 <span class=\"num\">48</span> 小时；跨省 <span class=\"num\">72</span> 小时；偏远区域 <span class=\"num\">120</span> 小时</li><li>来源：《【商家-物流轨迹超时】实施细则》</li></ul>",
        sourceId: "dy-rule-aHwHroCPheig",
        cardId: "penalty:2"
      },
      {
        title: "物流轨迹异常：虚假单号与处置",
        severity: "critical",
        severityText: "处罚",
        date: "2025-09-29",
        tags: ["轨迹异常", "虚假单号"],
        link: articleUrl("aHzmeN9E9dBF"),
        body: "<ul><li><span class=\"highlight\">常见情形</span>：上传后 <span class=\"num\">48</span> 小时未揽收、揽收后 <span class=\"num\">48</span> 小时无分拨、重复轨迹/运单号、地址不符、揽收早于支付、私自召回等</li><li>通用赔付：实付 <span class=\"num\">25%</span>（最低 <span class=\"num\">5</span> 元，最高 <span class=\"num\">100</span> 元）；贵金属等可提高至最高 <span class=\"num\">1000</span> 元</li><li>违规 <span class=\"num\">1</span> 次定义：日异常率&gt;<span class=\"num\">10%</span> 且异常单≥<span class=\"num\">20</span>；自然年累计可冻结货款、禁止上新、限制预售/精选联盟/成交</li><li>批量违规：可冻结近 <span class=\"num\">15</span> 天结算货款 <span class=\"num\">35%</span>（最低 <span class=\"num\">1000</span> 元）并停止结算，最长 <span class=\"num\">90</span> 天</li><li>来源：《【商家-物流轨迹异常】实施细则》</li></ul>",
        sourceId: "dy-rule-aHzmeN9E9dBF",
        cardId: "penalty:3"
      },
      {
        title: "欺诈发货：空包与加重处置",
        severity: "critical",
        severityText: "处罚",
        date: "2025-09-29",
        tags: ["欺诈发货", "空包"],
        link: articleUrl("aHwH9wK4JyWJ"),
        body: "<ul><li><span class=\"highlight\">定义</span>：未真实发货致物流完结消费者未收货，或发空包、买A发B、短装（数量差&gt;<span class=\"num\">50%</span>）等</li><li>赔付：实付 <span class=\"num\">30%</span>（最低 <span class=\"num\">10</span> 元，最高 <span class=\"num\">500</span> 元）；平台可主动关单退款</li><li>商品维度违规 <span class=\"num\">1</span> 次：当日欺诈发货≥<span class=\"num\">3</span> 单；自然年累计可冻结货款并停止结算（最高 <span class=\"num\">180</span> 天）、体验分扣 <span class=\"num\">15</span> 分、违约金最高 <span class=\"num\">2000</span> 元、清退</li><li>情节特别严重：可停业整顿、清退、扣除违规所得货款等</li><li>来源：《【商家-欺诈发货】实施细则》</li></ul>",
        sourceId: "dy-rule-aHwH9wK4JyWJ",
        cardId: "penalty:4"
      },
      {
        title: "其它加重措施与商家评级",
        severity: "critical",
        severityText: "处罚",
        date: "2025-09-29",
        tags: ["厂家自送", "商家评级"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li>滥用厂家自送、现货+预售批量投诉：可取消预售权限、下架商品；厂家自送最短关闭 <span class=\"num\">7</span> 天、最长永久</li><li>物流宣传与实际不符：按虚假宣传规则处置；超长未签收订单消费者退款可默认同意</li><li>多次违规或批量投诉：公示警告、限发品、冻结货款、清退、关联店铺处理等</li><li>违规发货计入<span class=\"highlight\">商家评级</span>负向指标，影响极速发货权益、大促活动等</li><li>来源：《商家发货行为管理规则》4.1.6</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "penalty:5"
      },
      {
        title: "申诉、除外与赔付说明",
        severity: "warning",
        severityText: "参考",
        date: "2025-09-29",
        tags: ["申诉", "除外"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li>不认可处罚可在收到通知后 <span class=\"num\">7</span> 个自然日内至【店铺-店铺保障-申诉中心】申诉</li><li>除外：不可抗力、大促/节假日调整时效、商品违法违规平台要求停发等</li><li>违约金从保证金/货款扣除，以无门槛现金券赔付消费者；保证金不足可暂停赔付</li><li>总纲处置索引参见【商家-违规发货违规处理手段】实施细则</li><li>来源：《商家发货行为管理规则》4.2、第五章；《【商家-违规发货违规处理手段】实施细则》</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "penalty:6"
      }
    ]
  }
};

const curatedInsights = {
  version: 1,
  updatedAt: timestamp,
  categories: {
    score: {
      pinned: true,
      sourceId: "dy-rule-103956",
      ruleTitle: "商家体验分规范",
      panelSubtitle: "2026年5月商家体验分规范要点（正式阶段）",
      generatedAt: timestamp,
      link: ruleUrl("103956"),
      changes: [
        {
          type: "modify",
          title: "成长/正式阶段分流考核",
          detail:
            "近30天有效支付订单 <span class=\"new-val\">&lt;30单</span> 为成长阶段（默认70分）；<span class=\"new-val\">≥30单</span> 进入正式阶段百分制考核（50～100分）。",
          date: "2026-05-07",
          link: ruleUrl("103956")
        },
        {
          type: "new",
          title: "差行为扣分机制",
          detail:
            "消极服务、刷单刷评等行为可累计扣分：客服嘲讽等每次扣 <span class=\"num\">3</span> 分（30天累计不超15分）；非正常手段刷体验分一次性扣 <span class=\"num\">15</span> 分。",
          date: "2026-05-07",
          link: ruleUrl("103956")
        },
        {
          type: "modify",
          title: "三维指标权重因行业而异",
          detail:
            "正式阶段体验分 = 商品体验×权重 + 物流体验×权重 + 服务体验×权重 − 差行为扣分；不同行业权重存在差异。",
          date: "2026-05-07",
          link: ruleUrl("103956")
        },
        {
          type: "new",
          title: "应用场景扩展",
          detail:
            "体验分影响 <span class=\"highlight\">千川投放、营销活动提报、精选联盟准入</span>；正式阶段分数以五星制向消费者展示。",
          date: "2026-05-07",
          link: ruleUrl("103956")
        }
      ],
      impacts: [
        {
          level: "high",
          title: "流量与投放",
          desc: "体验分低于管控线将限制千川投放及活动报名，直接影响获客。"
        },
        {
          level: "medium",
          title: "联盟与分销",
          desc: "精选联盟准入与体验分挂钩，低分将限制达人合作机会。"
        },
        {
          level: "medium",
          title: "消费者感知",
          desc: "正式阶段分数在店铺首页、商详页展示，直接影响转化与信任。"
        }
      ],
      strategies: [
        {
          level: "action",
          title: "监控三维指标",
          desc: "在抖店后台「商家体验分」查看商品、物流、服务各指标得分与行业对比，优先改善低于合格线的项。"
        },
        {
          level: "action",
          title: "避免差行为扣分",
          desc: "规范客服话术与售后处理，杜绝刷单刷评；成长阶段亦须避免消极服务导致降至60分。"
        },
        {
          level: "action",
          title: "关注揽收与售后时效",
          desc: "重点优化揽收时长、配送时效达成率、售后处理时长及飞鸽响应时长，均为正式阶段核心考核项。"
        }
      ]
    }
  }
};

async function loadExistingWatch() {
  try {
    const raw = await readFile(path.join(dataDir, "curated-watch.json"), "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return { sources: {} };
  }
}

const existingWatch = await loadExistingWatch();
const watchSources = {};
for (const source of curatedSources.sources) {
  const prev = existingWatch.sources?.[source.id] || {};
  watchSources[source.id] = {
    status: prev.status || "ok",
    message: prev.message || "manual curated from rules.json",
    ruleTitle: source.ruleTitle || prev.ruleTitle,
    platformModifiedAt: prev.platformModifiedAt || null,
    contentHash: prev.contentHash || `manual-${source.slug}`,
    lastSyncedAt: prev.lastSyncedAt || timestamp
  };
}

const curatedWatch = {
  version: existingWatch.version || 1,
  lastCheckedAt: existingWatch.lastCheckedAt || timestamp,
  autoPublishVersion: existingWatch.autoPublishVersion ?? 1,
  recentAutoPublish: existingWatch.recentAutoPublish ?? null,
  summary: existingWatch.summary || {
    published: 0,
    changed: 0,
    errors: 0,
    insightsGenerated: 0
  },
  sources: watchSources
};

async function writeBoth(name, data) {
  const json = `\uFEFF${JSON.stringify(data, null, 2)}`;
  for (const dir of [dataDir, publicDir]) {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), json, "utf8");
  }
}

async function writeRuleTextFallbacks() {
  const rulesPath = path.join(dataDir, "rules.json");
  const raw = await readFile(rulesPath, "utf8");
  const rules = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const byId = new Map(rules.map((r) => [String(r.id), r]));

  for (const source of curatedSources.sources) {
    const rule = byId.get(source.slug);
    if (!rule?.content) continue;
    const relPath = `data/douyin/rule-text/rule-${source.slug}.txt`;
    source.manualTextPath = relPath;
    for (const dir of [path.join(dataDir, "rule-text"), path.join(publicDir, "rule-text")]) {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `rule-${source.slug}.txt`), rule.content, "utf8");
    }
  }
}

await writeRuleTextFallbacks();
await writeBoth("curated-sources.json", curatedSources);
await writeBoth("curated-cards.json", curatedCards);
await writeBoth("curated-category-insights.json", curatedInsights);
await writeBoth("curated-watch.json", curatedWatch);

console.log(
  JSON.stringify(
    {
      ok: true,
      sources: curatedSources.sources.length,
      cards: Object.fromEntries(
        ["shelf", "score", "ship", "penalty"].map((k) => [k, curatedCards[k].cards.length])
      )
    },
    null,
    2
  )
);
