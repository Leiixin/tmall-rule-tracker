/**

 * 天猫/抖音 score 正式阶段指标表格防回归检查。

 * 运行: node scripts/audit-score-formal-metrics.mjs

 */

import { readFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";



const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");



const SCORE_METRIC_TITLE_RE =

  /商品负反馈率|商品好评率|48小时揽收|物流到货时长|物流差评率|旺旺3分钟|旺旺满意度|退款处理时长|平台求助率|商品综合评分|商品品质退货率|揽收时长|运单配送时效|发货物流品退|售后处理时长达成|飞鸽平均响应|飞鸽人工平均响应/;



const DOUYIN_FORMAL_COLUMNS = ["评分维度", "细分指标", "指标定义", "考核周期"];



const DOUYIN_DEFINITION_SNIPPETS = [

  "近30天物流签收订单中有商品评分的订单数",

  "飞鸽平均响应时长"

];



const PLATFORM_PATHS = [

  { platform: "tmall", relPath: "data/curated-cards.json", minRows: 7 },

  { platform: "douyin", relPath: "data/douyin/curated-cards.json", minRows: 7 }

];



function isDouyinRuleBlock(block, platform) {

  return block?.tableFormat === "douyinRule" || platform === "douyin";

}



function validateFormalStageMetrics(block, { platform } = {}) {

  const rows = Array.isArray(block?.rows) ? block.rows : [];

  if (rows.length < 3) {

    throw new Error("formalStageMetrics must have at least 3 rows");

  }



  const douyinRule = isDouyinRuleBlock(block, platform);



  if (douyinRule) {

    const cols = block?.columns || [];

    if (cols.length !== 4 || !DOUYIN_FORMAL_COLUMNS.every((c, i) => cols[i] === c)) {

      throw new Error(

        `douyin formalStageMetrics columns must be ${JSON.stringify(DOUYIN_FORMAL_COLUMNS)}`

      );

    }

    if (!block.mergeDimension) {

      throw new Error("douyin formalStageMetrics must set mergeDimension: true");

    }

    if (block.tableFormat !== "douyinRule") {

      throw new Error("douyin formalStageMetrics must set tableFormat: douyinRule");

    }

    for (const [index, row] of rows.entries()) {

      const dimension = String(row?.dimension || "").trim();

      const metric = String(row?.metric || "").trim();

      const definitionHtml = String(

        row?.definitionHtml || row?.detailHtml || ""

      ).trim();

      const assessmentPeriod = String(row?.assessmentPeriod || "").trim();

      if (!dimension || !metric || !definitionHtml) {

        throw new Error(

          `formalStageMetrics row ${index} missing dimension/metric/definitionHtml`

        );

      }

      if (!assessmentPeriod) {

        throw new Error(`formalStageMetrics row ${index} missing assessmentPeriod`);

      }

      if (/飞鸽人工平均响应/.test(metric)) {

        throw new Error(

          `formalStageMetrics row ${index} metric must be 飞鸽平均响应时长 (rule verbatim)`

        );

      }

    }

    const blob = rows.map((r) => r.definitionHtml || r.detailHtml || "").join("");

    for (const snippet of DOUYIN_DEFINITION_SNIPPETS) {

      if (!blob.includes(snippet)) {

        throw new Error(

          `douyin definitionHtml must include verbatim snippet: ${snippet}`

        );

      }

    }

    return;

  }



  for (const [index, row] of rows.entries()) {

    const dimension = String(row?.dimension || "").trim();

    const metric = String(row?.metric || "").trim();

    const detailHtml = String(row?.detailHtml || "").trim();

    if (!dimension || !metric || !detailHtml) {

      throw new Error(`formalStageMetrics row ${index} missing dimension/metric/detailHtml`);

    }

    if (!detailHtml.includes('class="highlight"')) {

      throw new Error(`formalStageMetrics row ${index} detailHtml must include highlight`);

    }

    if (!detailHtml.includes('class="num"')) {

      throw new Error(`formalStageMetrics row ${index} detailHtml must include num`);

    }

  }

}



async function readJson(relPath) {

  const raw = await readFile(path.join(repoRoot, relPath), "utf8");

  return JSON.parse(raw.replace(/^\uFEFF/, ""));

}



function fail(message, details = []) {

  return { ok: false, message, details };

}



function pass(summary) {

  return { ok: true, summary };

}



export function auditScoreFormalMetrics(cardsDoc, { platform, minRows = 3 } = {}) {

  const issues = [];

  const score = cardsDoc?.score;

  const block = score?.formalStageMetrics;

  const cards = score?.cards;



  if (!block) {

    return fail(`${platform}: score.formalStageMetrics missing`);

  }



  try {

    validateFormalStageMetrics(block, { platform });

  } catch (err) {

    issues.push(`${platform}: ${err.message}`);

  }



  const rows = block?.rows || [];

  if (rows.length < minRows) {

    issues.push(`${platform}: expected at least ${minRows} metric rows, got ${rows.length}`);

  }



  if (!Array.isArray(cards) || cards.length < 3) {

    issues.push(`${platform}: score.cards must have at least 3 note cards`);

  }



  for (const card of cards || []) {

    const ref = card.cardId || card.title || "unknown";

    if (SCORE_METRIC_TITLE_RE.test(String(card.title || ""))) {

      issues.push(`${platform}: ${ref} card title looks like a formal metric (should be in table)`);

    }

  }



  if (issues.length) {

    return fail("score formal metrics audit failed", issues);

  }



  return pass({

    platform,

    metricRows: rows.length,

    noteCards: cards.length

  });

}



async function main() {

  const results = [];

  let failed = false;



  for (const { platform, relPath, minRows } of PLATFORM_PATHS) {

    const cardsDoc = await readJson(relPath);

    const result = auditScoreFormalMetrics(cardsDoc, { platform, minRows });

    if (!result.ok) {

      failed = true;

      console.error(JSON.stringify(result, null, 2));

    } else {

      results.push(result.summary);

    }

  }



  if (failed) {

    process.exit(1);

  }



  console.log(JSON.stringify({ ok: true, platforms: results }, null, 2));

}



const isMain =

  process.argv[1] &&

  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);



if (isMain) {

  main().catch((err) => {

    console.error("[audit-score-formal-metrics] failed:", err);

    process.exit(1);

  });

}

