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
      url: ruleUrl("aJk964FFQKKZ"),
      label: "商品保质期与临期标注",
      categories: ["shelf"],
      cardIds: ["shelf:0", "shelf:1", "shelf:2"],
      ruleTitle: "关于修订《商品保质期管理和宣传规范》的公示通知"
    },
    {
      id: "dy-rule-aHGYneqr4WDJ",
      slug: "aHGYneqr4WDJ",
      platform: "douyin",
      url: ruleUrl("aHGYneqr4WDJ"),
      label: "盲盒类商品信息公示",
      categories: ["shelf"],
      cardIds: ["shelf:3"],
      ruleTitle: "盲盒类商品管理规范"
    },
    {
      id: "dy-rule-103956",
      slug: "103956",
      platform: "douyin",
      url: ruleUrl("103956"),
      label: "商家体验分考核",
      categories: ["score"],
      cardIds: ["score:0", "score:1", "score:2"],
      ruleTitle: "商家体验分规范"
    },
    {
      id: "dy-rule-113278",
      slug: "113278",
      platform: "douyin",
      url: ruleUrl("113278"),
      label: "消极服务与售后",
      categories: ["ship"],
      cardIds: ["ship:0", "ship:1"],
      ruleTitle: "【商家—消极服务】细则"
    },
    {
      id: "dy-rule-aHu5aT4aoQXD",
      slug: "aHu5aT4aoQXD",
      platform: "douyin",
      url: ruleUrl("aHu5aT4aoQXD"),
      label: "物流轨迹与发货时效",
      categories: ["ship"],
      cardIds: ["ship:2"],
      ruleTitle: "发货常见问题—物流轨迹超时"
    },
    {
      id: "dy-rule-113470",
      slug: "113470",
      platform: "douyin",
      url: ruleUrl("113470"),
      label: "虚假交易认定与处罚",
      categories: ["penalty"],
      cardIds: ["penalty:0", "penalty:1"],
      ruleTitle: "【虚假交易】实施细则"
    },
    {
      id: "dy-rule-aJ2ymdS5jWGZ",
      slug: "aJ2ymdS5jWGZ",
      platform: "douyin",
      url: ruleUrl("aJ2ymdS5jWGZ"),
      label: "价格违规场景",
      categories: ["penalty"],
      cardIds: ["penalty:2"],
      ruleTitle: "商家【价格违规】细则"
    },
    {
      id: "dy-rule-101805",
      slug: "101805",
      platform: "douyin",
      url: ruleUrl("101805"),
      label: "发布禁售商品",
      categories: ["penalty"],
      cardIds: ["penalty:3"],
      ruleTitle: "【发布法规禁止商品/信息】细则"
    }
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
      "抖音在售商品保质期、临期标注与禁售标准，依据《商品保质期管理和宣传规范》《盲盒类商品管理规范》（2026年6月修订公示）。",
    cards: [
      {
        title: "临期商品标题与详情标注",
        severity: "critical",
        severityText: "强制",
        date: "2026-06-02",
        tags: ["临期", "标注"],
        link: ruleUrl("aJk964FFQKKZ"),
        body: "<ul><li>临期商品须在标题写明 <span class=\"highlight\">「临期商品」</span> 字样</li><li>详情页最上方显著标示「此商品为临近保质期商品」</li><li>临期起算时间以商家发货后物流公司系统 <span class=\"highlight\">揽收时间</span> 为准</li><li>来源：《商品保质期管理和宣传规范》3.3</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:0"
      },
      {
        title: "临期天数分级标准",
        severity: "critical",
        severityText: "强制",
        date: "2026-06-02",
        tags: ["保质期", "禁售"],
        link: ruleUrl("aJk964FFQKKZ"),
        body: "<ul><li>保质期以月/年换算：1月=<span class=\"num\">30</span>天，1年=<span class=\"num\">365</span>天，临期天数向上取整</li><li>例：保质期365～730天，剩余≤<span class=\"num\">30</span>天为临期</li><li>国家/地区标准严于平台时，按更严标准执行</li><li>来源：《商品保质期管理和宣传规范》3.2</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:1"
      },
      {
        title: "酒类「新鲜日期」宣传要求",
        severity: "warning",
        severityText: "警告",
        date: "2026-06-02",
        tags: ["酒类", "宣传"],
        link: ruleUrl("aJk964FFQKKZ"),
        body: "<ul><li>宣传酒类「新鲜日期」时，签收日期与生产日期时间差不得超过保质期的 <span class=\"num\">1/3</span></li><li>违规按商家【虚假宣传】、创作者虚假宣传细则处理</li><li>平台 <span class=\"highlight\">禁止销售过期商品</span></li><li>来源：《商品保质期管理和宣传规范》3.7、4.1</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:2"
      },
      {
        title: "盲盒商品信息公示要求",
        severity: "warning",
        severityText: "规范",
        date: "2026-05-29",
        tags: ["盲盒", "商品信息"],
        link: ruleUrl("aHGYneqr4WDJ"),
        body: "<ul><li>详情页须描述可获得的所有内容明细，显著提醒「盲盒类商品具有不确定性」</li><li>须明示抽盒规则、商品分布、隐藏款概率、价值范围等关键信息</li><li>不得虚假宣传必中款、百分百中等引人误解信息</li><li>来源：《盲盒类商品管理规范》4.5</li></ul>",
        sourceId: "dy-rule-aHGYneqr4WDJ",
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
      "发货揽收、物流轨迹与售后响应要求，依据《商家体验分规范》物流指标及《【商家—消极服务】细则》。",
    cards: [
      {
        title: "消极服务常见场景",
        severity: "critical",
        severityText: "处罚",
        date: "2026-05-29",
        tags: ["客服", "飞鸽"],
        link: ruleUrl("113278"),
        body: "<ul><li>包括嘲讽贬低消费者、<span class=\"highlight\">响应慢/不响应</span>（平均响应&gt;90秒）、无故拉黑等</li><li>情节一般：自然周10通以上会话违规，扣违约金 <span class=\"num\">100元</span></li><li>嘲讽贬低消费者可扣订单实付 <span class=\"num\">5%</span> 赔付消费者（单次5～30元）</li><li>来源：《【商家—消极服务】细则》一</li></ul>",
        sourceId: "dy-rule-113278",
        cardId: "ship:0"
      },
      {
        title: "无故拒绝售后",
        severity: "critical",
        severityText: "强制",
        date: "2026-05-29",
        tags: ["售后", "退款"],
        link: ruleUrl("113278"),
        body: "<ul><li>无理由关闭售后、未上传有效沟通记录即拒绝等，经平台判定为商家责任</li><li>情节一般：售后拒绝率&gt;行业均值5倍且日均无故拒绝≥5笔，扣违约金 <span class=\"num\">100元</span> 并冻结货款结算</li><li>可扣订单实付 <span class=\"num\">10%</span> 赔付消费者（单次5～50元）</li><li>来源：《【商家—消极服务】细则》二</li></ul>",
        sourceId: "dy-rule-113278",
        cardId: "ship:1"
      },
      {
        title: "揽收时效考核要点",
        severity: "warning",
        severityText: "参考",
        date: "2026-05-07",
        tags: ["揽收", "物流"],
        link: ruleUrl("103956"),
        body: "<ul><li>现货订单：消费者支付次日 <span class=\"num\">23:59:59</span> 前完成揽收计为达成</li><li>预售订单：在承诺发货时效前揽收计为达成</li><li>存在欺诈发货或物流轨迹异常赔付的订单，计为不达成</li><li>物流轨迹超时等问题参照《商家发货行为管理规则》处理</li></ul>",
        sourceId: "dy-rule-aHu5aT4aoQXD",
        cardId: "ship:2"
      }
    ]
  },
  penalty: {
    tag: "VIOLATIONS & PENALTIES",
    title: "发货违规及处罚",
    desc:
      "虚假交易、价格违规、禁售商品等必读细则，依据《【虚假交易】实施细则》《商家【价格违规】细则》《【发布法规禁止商品/信息】细则》。",
    cards: [
      {
        title: "虚假交易违规定义",
        severity: "critical",
        severityText: "强制",
        date: "2026-05-29",
        tags: ["刷单", "虚假交易"],
        link: ruleUrl("113470"),
        body: "<ul><li>通过虚构交易、刷单刷评、刷分炒信等方式获取 <span class=\"highlight\">虚假销量、体验分、流量或榜单排名</span></li><li>包括自有/马甲账号购买、虚假物流、诱导好评返现等</li><li>平台可基于大数据从发货、账号、行为、售后等维度综合判定</li><li>来源：《【虚假交易】实施细则》</li></ul>",
        sourceId: "dy-rule-113470",
        cardId: "penalty:0"
      },
      {
        title: "虚假交易商家处罚梯度",
        severity: "critical",
        severityText: "处罚",
        date: "2026-05-29",
        tags: ["违约金", "清退"],
        link: ruleUrl("113470"),
        body: "<ul><li><span class=\"highlight\">情节严重</span>：限制营销活动 <span class=\"num\">14天</span>，违约金为虚假交易支付金额×<span class=\"num\">1%</span>（最低1000元，最高20000元）</li><li><span class=\"highlight\">情节特别严重</span>：店铺清退</li><li>申诉时效：判罚后 <span class=\"num\">7天</span> 内</li><li>来源：《【虚假交易】实施细则》</li></ul>",
        sourceId: "dy-rule-113470",
        cardId: "penalty:1"
      },
      {
        title: "价格违规主要场景",
        severity: "warning",
        severityText: "警告",
        date: "2026-05-29",
        tags: ["价格", "SKU"],
        link: ruleUrl("aJ2ymdS5jWGZ"),
        body: "<ul><li><span class=\"highlight\">价格设定不合理</span>：售价超出类目常规区间、SKU价差异常</li><li><span class=\"highlight\">价格虚假或虚构</span>：虚构划线价/折扣、标题或主图价格与实际不符</li><li><span class=\"highlight\">低价SKU作弊</span>：跨品类混卖、小规格拆分、无意义SKU引流</li><li>情节特别严重：商品封禁、店铺清退</li></ul>",
        sourceId: "dy-rule-aJ2ymdS5jWGZ",
        cardId: "penalty:2"
      },
      {
        title: "发布禁售/违禁商品",
        severity: "critical",
        severityText: "强制",
        date: "2026-05-29",
        tags: ["禁售", "违禁品"],
        link: ruleUrl("101805"),
        body: "<ul><li>发布法律法规及平台禁止销售的商品或信息</li><li>禁售商品不得作为盲盒、福袋等形式出售</li><li>情节严重可 <span class=\"highlight\">店铺清退</span></li><li>来源：《【发布法规禁止商品/信息】细则》</li></ul>",
        sourceId: "dy-rule-101805",
        cardId: "penalty:3"
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

const watchSources = {};
for (const source of curatedSources.sources) {
  watchSources[source.id] = {
    status: "ok",
    message: "manual curated from rules.json",
    ruleTitle: source.ruleTitle,
    platformModifiedAt: timestamp,
    contentHash: `manual-${source.slug}`,
    lastSyncedAt: timestamp
  };
}

const curatedWatch = {
  version: 1,
  lastCheckedAt: timestamp,
  autoPublishVersion: 1,
  recentAutoPublish: null,
  summary: {
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
