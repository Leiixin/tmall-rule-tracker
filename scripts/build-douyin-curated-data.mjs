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

/** 商品效期要求唯一来源（规则众议院文章页） */
const SHELF_ARTICLE_URL =
  "https://school.jinritemai.com/doudian/web/article/aJk964FFQKKZ";

const SCORE_ARTICLE_URL =
  "https://school.jinritemai.com/doudian/web/article/103956";

/** 发货时效 + 发货违规及处罚 统一来源 */
const SHIP_PENALTY_ARTICLE_URL =
  "https://school.jinritemai.com/doudian/web/article/101706";

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
      cardIds: ["ship:0", "ship:1", "ship:2", "penalty:0", "penalty:1", "penalty:2"],
      ruleTitle: "商家发货行为管理规则"
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
      "抖音在售商品保质期、临期标注与禁售标准，唯一依据《商品保质期管理和宣传规范》（公示期 2026-05-26～2026-06-02，预计 2026-06-02 生效）。",
    cards: [
      {
        title: "临期商品标题与详情标注",
        severity: "critical",
        severityText: "强制",
        date: "2026-06-02",
        tags: ["临期", "标注"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li>临期商品须在标题写明 <span class=\"highlight\">「临期商品」</span> 字样</li><li>详情页最上方显著标示「此商品为临近保质期商品」</li><li>临期起算时间以商家发货后物流公司系统 <span class=\"highlight\">揽收时间</span> 为准</li><li>来源：《商品保质期管理和宣传规范》3.3</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:0"
      },
      {
        title: "临期天数分级标准",
        severity: "critical",
        severityText: "强制",
        date: "2026-06-02",
        tags: ["保质期", "临期"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li><span class=\"highlight\">换算规则</span>：保质期以「月」计按 <span class=\"num\">1月=30天</span>；以「年」计按 <span class=\"num\">1年=365天</span>；临期天数<strong>向上取整</strong></li><li><span class=\"highlight\">365天≤保质期</span>：剩余保质期 <span class=\"num\">0～45天</span>（含）为临期</li><li><span class=\"highlight\">180天≤保质期＜365天</span>：剩余 <span class=\"num\">0～30天</span>（含）为临期</li><li><span class=\"highlight\">90天≤保质期＜180天</span>：剩余 <span class=\"num\">0～20天</span>（含）为临期</li><li><span class=\"highlight\">30天≤保质期＜90天</span>：剩余 <span class=\"num\">0～10天</span>（含）为临期</li><li><span class=\"highlight\">15天≤保质期＜30天</span>：剩余 <span class=\"num\">0～5天</span>（含）为临期</li><li><span class=\"highlight\">保质期＜15天</span>：剩余 <span class=\"num\">0～4天</span>（含）为临期</li><li>国家/地区临期标准严于上述时，按更严标准执行；个护家清行业另见《【个护家清】商品发布细则》</li><li>来源：《商品保质期管理和宣传规范》3.2、3.5、3.6</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:1"
      },
      {
        title: "酒类「新鲜日期」宣传要求",
        severity: "warning",
        severityText: "警告",
        date: "2026-06-02",
        tags: ["酒类", "宣传"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li>宣传酒类「新鲜日期」时，<span class=\"highlight\">签收日期与生产日期时间差</span>不得超过保质期的 <span class=\"num\">1/3</span></li><li>例：保质期90天、差值22天，未超30天（1/3）即符合标准</li><li>违规按商家【虚假宣传】、创作者虚假宣传细则处理</li><li>来源：《商品保质期管理和宣传规范》3.7</li></ul>",
        sourceId: "dy-rule-aJk964FFQKKZ",
        cardId: "shelf:2"
      },
      {
        title: "过期禁售与效期违规处理",
        severity: "critical",
        severityText: "处罚",
        date: "2026-06-02",
        tags: ["过期", "违规"],
        link: SHELF_ARTICLE_URL,
        body: "<ul><li>平台 <span class=\"highlight\">禁止销售过期商品</span>，违者按禁售商品细则处理</li><li>包装篡改/手写/模糊保质期、内外包装日期不一致：按商品标识标志不合格细则处理</li><li>临期商品未按 3.3 提示临期特性：按关键信息不明确细则处理</li><li>适用类目含水饮冲调、休闲食品、酒类、母婴、个护家清等（见规则正文）</li></ul>",
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
      "发货超时、缺货、物流轨迹异常、欺诈发货等违规场景与平台处置，依据《商家发货行为管理规则》第四章（2025-09-29 修订生效）。",
    cards: [
      {
        title: "发货超时与缺货/无货",
        severity: "critical",
        severityText: "强制",
        date: "2025-09-29",
        tags: ["发货超时", "缺货"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li><span class=\"highlight\">发货超时</span>：未在承诺发货时效内发货，详见【商家-发货超时】实施细则</li><li><span class=\"highlight\">缺货/无货</span>：承认缺货、无法联系、超时仍未发货等，订单/商品可判缺货违规</li><li>蟹卡+实物兑换双违规的，平台可对两类履约同时处置并赔付体验损失</li><li>来源：《商家发货行为管理规则》4.1.1、4.1.2</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "penalty:0"
      },
      {
        title: "物流轨迹超时与异常",
        severity: "critical",
        severityText: "处罚",
        date: "2025-09-29",
        tags: ["物流轨迹", "揽收"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li><span class=\"highlight\">轨迹超时</span>：发货后未在规定时效内回传揽收，或揽收后未回传分拨记录</li><li><span class=\"highlight\">轨迹异常</span>：单号/轨迹明显异常，或合理期限内消费者未收到商品</li><li>分别参见【商家-物流轨迹超时】【商家-物流轨迹异常】实施细则</li><li>来源：《商家发货行为管理规则》4.1.3、4.1.4</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "penalty:1"
      },
      {
        title: "欺诈发货与其它加重措施",
        severity: "critical",
        severityText: "处罚",
        date: "2025-09-29",
        tags: ["欺诈发货", "申诉"],
        link: SHIP_PENALTY_ARTICLE_URL,
        body: "<ul><li><span class=\"highlight\">欺诈发货</span>：未真实发货致物流完结时消费者未收到货，详见【商家-欺诈发货】实施细则</li><li>滥用厂家自送、现货+预售批量投诉等可关闭权限、下架商品</li><li>多次违规或批量投诉：可警告、限发品、冻结货款、清退等；违规计入<span class=\"highlight\">商家评级</span>负向指标</li><li>不认可处罚可在 <span class=\"num\">7</span> 个自然日内至【店铺保障-申诉中心】申诉</li><li>来源：《商家发货行为管理规则》4.1.5、4.1.6、第五章</li></ul>",
        sourceId: "dy-rule-101706",
        cardId: "penalty:2"
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
