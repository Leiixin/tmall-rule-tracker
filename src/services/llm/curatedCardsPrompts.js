import { INLINE_HIGHLIGHT_SPAN_RULE } from "./prompts.js";

export const CURATED_CARDS_PROMPT_VERSION = "7";

export const SCORE_FORMAL_METRICS_RULES = `体验分分类页结构（必守，正式阶段指标表格 + 注意事项卡片）：
- 输出 JSON 须同时含 formalStageMetrics 与 cards。
- formalStageMetrics：正式阶段（近30天有效/支付订单 ≥ 30 单）各维度考核指标，每项占 rows 一行。
  - 须设 tableFormat: "douyinRule"、mergeDimension: true。
  - columns 固定为 ["评分维度", "细分指标", "指标定义", "考核周期"]。
  - rows 每项：dimension（维度名，如宝贝质量/物流速度/服务保障）、metric（指标名）、definitionHtml（计算公式/说明，须含 span.highlight 与 span.num）、assessmentPeriod（考核周期，从公式分母归纳，如「近30天物流签收订单」）。
  - 可选 subheading；heading 固定为「正式阶段考核指标」；subheading 可注明部分类目统计周期为近90天；footnoteHtml 留空或不填（档位标准、指标升级说明写在 cards，勿写表下脚注）。
  - 部分类目单独考核等指标可用 <br><span class="card-metric-note">*注：…</span> 写在 definitionHtml 内。
- cards：只写非指标注意事项（定义与阶段分界、正式阶段计算公式与权重、应用场景、差行为/违规降分、加分与特殊计分等）；禁止单独建「成长阶段体验分规则」卡片（成长阶段仅在定义卡一句带过）
- 禁止为单项考核指标单独建卡（指标只进 formalStageMetrics.rows）`;

export const DOUYIN_SCORE_TABLE_RULES = `抖音体验分正式阶段指标表格（必守，对齐《商家体验分规范》2.3.1 评分维度表）：
- formalStageMetrics 须设 tableFormat: "douyinRule"、mergeDimension: true。
- columns 固定为 ["评分维度", "细分指标", "指标定义", "考核周期"]。
- rows 每项：dimension、metric、definitionHtml（指标定义与 *注 说明须照抄规则原文，禁止改写公式；*注 用 <br><span class="card-metric-note">*注：…</span>）、assessmentPeriod（考核周期原文）。超长 *注 须在顿号、逗号或列举项之间插入 <br> 或 <wbr> 辅助折行，勿仅依赖 CSS。
- 禁止在 definitionHtml 中强行添加 span.highlight / span.num（与天猫不同）。
- footnoteHtml 可不填或留空（六档分档、揽收时长例外等写在「正式阶段计算公式与分档」卡片，勿写表下脚注）；80 分兜底、偏远物流加分写在「加分与特殊分数计算」卡片。
- 指标名须与规则一致（如「飞鸽平均响应时长」，禁止「飞鸽人工平均响应时长」）。
- cards：禁止「成长阶段体验分规则」独立卡片；「加分与特殊分数计算」卡片中 80 分兜底用一条 li 概括（订单数＜300 或 500 按行业、差评/品退≤3），勿用内嵌表格。正式阶段表：rows 逐行输出 metric、assessmentPeriod、definitionHtml；前端仅合并评分维度列，细分指标/考核周期每行独立并纵向居中，指标定义列在格内折行；无横向滚动。
- 禁止为单项考核指标单独建卡。`;

export const DOUYIN_SHIP_STRUCTURE_RULES = `抖音发货时效分类页卡片（必守，对齐天猫 ship 卡片 highlight/num 格式）：
- body 使用 <ul><li>；每条 li 15～50 字，只写发货时限、认定、轨迹超时/异常认定、免责情形；禁止写扣罚比例、赔付金额（留给 penalty 分类）。
- 时效数字、截止时刻、小时/天数阈值必须用 <span class="num">...</span>（如 16:00、23:59:59、48 小时）。
- 发货模式名、认定口径、轨迹超时/异常/欺诈发货等类型名、最短时效等要点必须用 <span class="highlight">...</span>。
- 示例 li：<li><span class="highlight">极速发货</span>：当日<span class="num">16:00</span>前付款订单当日<span class="num">23:59:59</span>前发货</li>
- 禁止 body 出现：参见、详见、参考、来源：《 等指向其他规则的表述。`;

export const DOUYIN_PENALTY_IMPLEMENTATION_RULES = `抖音发货违规实施细则卡片（必守，对齐天猫 penalty 卡片格式，当前正文即该细则全文）：
- 只输出 1 张卡片；标题仅写违规类型名（如「缺货/无货」「发货超时」），≤10 字，禁止「：认定与扣罚」等后缀。
- body 结构（按顺序）：
  1) <ul> 内：首条 li <span class="highlight">认定：</span> + 总括句 +「包括但不限于：」；后续 li 为认定①、认定②…
  2) 【发货超时】【缺货/无货】细则：扣罚标准必须用表格，格式：
     <p class="card-penalty-heading"><span class="highlight">订单扣罚标准</span></p>
     <div class="card-penalty-table-wrap"><table class="card-penalty-table"><thead>…</thead><tbody>…</tbody></table></div>
     - 发货超时：3 行（承诺时效档位）× 2 列（超时48h内/外）；缺货/无货：3 行 × 1 列扣罚；缺货/无货可在表后用 <p class="card-penalty-note"> 写「可与发货超时同时发起」等说明
  3) 其它实施细则（物流轨迹超时/异常、欺诈发货）：扣罚仍用 ul/li，每条时效档位单独 1 li
  4) 表格/li 内数字用 span.num；禁止合并多档于一条 li（表格行除外）
- 示例认定 li：<li><span class="highlight">认定①：</span>延迟发货后 <span class="num">72</span> 小时仍未发货</li>
- 禁止 body 出现：参见、详见、参考、来源：《、违规处理细则参见 等指向其他规则的表述。
- 只依据下方正文摘录数字与比例，禁止编造。每条 li 15～80 字。`;

const CATEGORY_META = {
  shelf: {
    title: "商品效期要求",
    focus:
      "保质期、临期标注、禁售阈值；面向商家运营可执行的要点。",
    structureRules: `效期分类页卡片结构（必守）：
- 不同效期阶段/场景须分卡，禁止混在一张：保质期定义与换算、临期标注与详情展示、临期天数分级、禁售与违规处理（含 3.7 酒类「新鲜日期」宣传标准与 4.4 违规处理外链）等（原文有则写，无则跳过）；禁止单独建「酒类新鲜日期」卡。
- 禁止单独建「临期未标注」「化妆品类目临期」「保健品类目临期」等冗余卡；临期未标注等违规处理写在「禁售过期商品及违规处理」卡，个护家清临期标准写在「临期商品分级标准」卡并附《【个护家清】商品发布细则》外链。
- 天猫「临期商品定义与标注要求」卡（shelf:0）：表上 1 条 li 写标注要求；临保期 9 档须用 <div class="card-penalty-table-wrap"><table class="card-penalty-table"> 两列（保质期 / 临保期）展示；表外 li 写来源。
- 「临期商品分级标准（按保质期）」卡：表上方 1 条 li 写换算规则；6 档分级须用 <div class="card-penalty-table-wrap"><table class="card-penalty-table"> 两列（保质期 / 临期标准剩余保质期）展示；表外 li 附个护家清细则外链。
- 违规处理卡须附对应细则链接（发布平台/法规禁止商品、标识标志不合格、关键信息不明确、商家虚假宣传、创作者款式/颜色虚假宣传等）；每张卡 body 只写该阶段要点。`,
    cardCount: "4～5"
  },
  score: {
    title: "店铺真实体验分",
    focus:
      "真实体验分定义、各维度指标、计算公式、应用场景、违规降分；突出新规变化。",
    structureRules: SCORE_FORMAL_METRICS_RULES,
    cardCount: "4～8"
  },
  ship: {
    title: "发货时效",
    focus:
      "发货时限、发货认定、物流轨迹超时与异常认定、免责情形；不写赔付比例（留给处罚类）。",
    structureRules: null,
    cardCount: "3～8"
  },
  penalty: {
    title: "发货违规及处罚",
    focus:
      "延迟发货、缺货、虚假发货、轨迹超时/异常的认定与赔付比例、处罚措施。",
    structureRules: `违规分类页卡片结构（必守）：
- 卡片标题须为具体违规行为名称（如「发货超时」「缺货/无货」「虚假发货」「物流轨迹超时」），与原文细则名称一致，禁止笼统「违规处罚汇总」。
- 每张卡 body 必须包含：①违规定义或认定条件；②订单扣罚/赔付标准（比例、上下限、按实付/按单；分层处罚须分 li）。
- 不写发货时限认定（留给发货时效类）；只取处罚相关段落。`,
    cardCount: "4～10"
  },
  intl_expiry: {
    title: "效期与效期管理",
    focus:
      "天猫国际跨境在售商品的保质期、临期标注、禁售标准、效期信息展示真实性；适用于食品、美妆、保健品等类目。",
    structureRules: `国际效期卡片结构：同「商品效期要求」——阶段分卡；化妆品/隐形眼镜/保健品原文有则各独立成卡。`,
    cardCount: "4～10"
  },
  intl_logistics: {
    title: "跨境物流与发货",
    focus:
      "保税/直邮发货时效、物流轨迹、大促期间发货调整及交易流程；含天猫/天猫国际联合公告要点。",
    structureRules: null,
    cardCount: "3～8"
  },
  intl_qual: {
    title: "资质与品牌",
    focus: "品牌授权、资质文件、跨境经营资质与合规要求。",
    structureRules: null,
    cardCount: "3～8"
  },
  intl_penalty: {
    title: "违规与处罚",
    focus: "延迟发货、物流违规、效期违规等的认定与处罚措施。",
    structureRules: `国际违规卡片结构：同「发货违规及处罚」——标题为具体违规，body 含认定 + 扣罚标准。`,
    cardCount: "4～10"
  }
};

function advisorForPlatform(platform, category) {
  if (platform === "douyin") {
    return "抖音电商商家运营顾问";
  }
  if (platform === "intl" || String(category).startsWith("intl_")) {
    return "天猫国际跨境商家运营顾问";
  }
  return "天猫商家运营顾问";
}

export function isDouyinPenaltyImplementationSource(source, category, platform) {
  if (platform !== "douyin" || category !== "penalty" || !source) {
    return false;
  }
  const blob = `${source.label || ""}${source.ruleTitle || ""}${source.id || ""}`;
  return /实施细则/.test(blob);
}

export function isDouyinShipCategory(category, platform) {
  return platform === "douyin" && category === "ship";
}

export function isScoreCategory(category) {
  return category === "score";
}

export function isDouyinPenaltyTableSource(source) {
  if (!source) {
    return false;
  }
  const blob = `${source.label || ""}${source.ruleTitle || ""}`;
  return /发货超时|缺货\/无货/.test(blob);
}

export function buildCuratedCardsSystemPrompt(
  category,
  platform = "tmall",
  options = {}
) {
  const meta = CATEGORY_META[category] || {
    title: category,
    focus: "",
    structureRules: null,
    cardCount: "3～8"
  };
  const advisor = advisorForPlatform(platform, category);
  const singleDouyinPenalty = isDouyinPenaltyImplementationSource(
    options.source,
    category,
    platform
  );
  const douyinShip = isDouyinShipCategory(category, platform);
  const douyinScore = platform === "douyin" && isScoreCategory(category);

  let structureBlock = meta.structureRules
    ? `\n${meta.structureRules}\n`
    : "";
  if (douyinScore) {
    structureBlock = `\n${DOUYIN_SCORE_TABLE_RULES}\n`;
  } else if (singleDouyinPenalty) {
    structureBlock += `\n${DOUYIN_PENALTY_IMPLEMENTATION_RULES}\n`;
  } else if (douyinShip) {
    structureBlock += `\n${DOUYIN_SHIP_STRUCTURE_RULES}\n`;
  }

  const cardCount =
    options.cardCount ||
    (singleDouyinPenalty ? "1" : meta.cardCount);

  const liLengthRule = singleDouyinPenalty
    ? "每条 li 15～80 字"
    : "每条 li 15～50 字";
  const titleRule = singleDouyinPenalty
    ? "标题仅违规类型名（≤10 字，禁止冒号后缀）"
    : "卡片标题（8~30字）";

  const outputFormat = isScoreCategory(category)
    ? douyinScore
      ? `{
  "formalStageMetrics": {
    "heading": "正式阶段考核指标",
    "subheading": "近30天有效支付订单 ≥ 30 单（正式阶段）",
    "tableFormat": "douyinRule",
    "columns": ["评分维度", "细分指标", "指标定义", "考核周期"],
    "mergeDimension": true,
    "rows": [
      {
        "dimension": "商品体验",
        "metric": "商品综合评分",
        "definitionHtml": "商品综合评分 = 近30天物流签收订单中…（照抄规则原文）",
        "assessmentPeriod": "近30天物流签收订单"
      }
    ],
    "footnoteHtml": "规则表外说明（分档、兜底分等）"
  },
  "cards": [
    {
      "title": "${titleRule}",
      "severity": "critical|warning|info|normal",
      "severityText": "强制|警告|参考|通知等",
      "date": "YYYY-MM-DD",
      "tags": ["标签1", "标签2"],
      "body": "<ul><li>要点</li></ul>"
    }
  ]
}`
      : `{
  "formalStageMetrics": {
    "heading": "正式阶段考核指标",
    "subheading": "近30天有效支付订单 ≥ 30 单（正式阶段；部分类目统计周期为近90天）",
    "tableFormat": "douyinRule",
    "mergeDimension": true,
    "columns": ["评分维度", "细分指标", "指标定义", "考核周期"],
    "rows": [
      {
        "dimension": "宝贝质量",
        "metric": "商品负反馈率",
        "definitionHtml": "<span class=\\"highlight\\">商品负反馈率</span> = 近<span class=\\"num\\">30</span>天…",
        "assessmentPeriod": "近30天物流签收订单"
      }
    ]
  },
  "cards": [
    {
      "title": "${titleRule}",
      "severity": "critical|warning|info|normal",
      "severityText": "强制|警告|参考|通知等",
      "date": "YYYY-MM-DD",
      "tags": ["标签1", "标签2"],
      "body": "<ul><li>要点</li></ul>"
    }
  ]
}`
    : `{
  "cards": [
    {
      "title": "${titleRule}",
      "severity": "critical|warning|info|normal",
      "severityText": "强制|警告|参考|通知等",
      "date": "YYYY-MM-DD",
      "tags": ["标签1", "标签2"],
      "body": "<ul><li>要点</li></ul>"
    }
  ]
}`;

  return `你是${advisor}。根据用户提供的规则原文，为「${meta.title}」分类页生成展示 JSON（不要 markdown）。

分类侧重：${meta.focus}
${structureBlock}
输出格式：
${outputFormat}

规则：
- 生成 ${cardCount} 张 cards${isScoreCategory(category) ? "（不含单项考核指标卡）" : ""}，按主题拆分，不要把所有内容挤进一张。
- body 使用 <ul><li>，${INLINE_HIGHLIGHT_SPAN_RULE}。
- ${liLengthRule}；只依据原文，禁止编造；信息不足则保守表述。
- date 使用用户提供的平台修订日期。
- 不要输出 link 字段（由系统补充）。
- 使用简体中文。`;
}

export function buildCuratedCardsUserPrompt({
  category,
  ruleTitle,
  platformModifiedAt,
  content,
  source,
  platform = "tmall",
  maxChars = 8000
}) {
  const meta = CATEGORY_META[category] || { title: category };
  const singleDouyinPenalty = isDouyinPenaltyImplementationSource(
    source,
    category,
    platform
  );
  const sourceHint = singleDouyinPenalty
    ? `\n来源：${source?.label || source?.id || "未知"}（${source?.id || ""}）
要求：下方正文即该实施细则全文，只生成 1 张卡片。标题仅违规类型名；body 用「认定：总括 + 认定①②… + 扣罚标准每条独立 li」，对齐天猫 penalty 格式，勿写参见其他规则。\n`
    : source?.id
      ? `\n来源 ID：${source.id}${source.label ? `（${source.label}）` : ""}\n`
      : "";

  return `分类：${meta.title}
规则标题：${ruleTitle || "未知"}
平台修订时间：${platformModifiedAt || "未知"}${sourceHint}

正文：
${String(content || "").slice(0, maxChars)}

请输出${isScoreCategory(category) ? " formalStageMetrics + cards " : " cards "}JSON，仅包含本分类相关要点。`;
}
