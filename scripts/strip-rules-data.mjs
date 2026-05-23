import { readFile, writeFile } from "node:fs/promises";

const REPLACEMENT = `let RULES_DATA = null;
let curatedSourcesData = { version: 1, sources: [], repoEditUrl: 'https://github.com/Leiixin/tmall-rule-tracker/edit/main/data/curated-sources.json' };
let curatedWatchData = null;

const RULES_DATA_FALLBACK = {
  shelf: { tag: 'SHELF-LIFE RULES', title: '商品效期要求', desc: '正在加载规则卡片…', cards: [] },
  score: { tag: 'EXPERIENCE SCORE', title: '店铺真实体验分', desc: '正在加载规则卡片…', cards: [] },
  ship: { tag: 'SHIPPING TIMELINE', title: '发货时效', desc: '正在加载规则卡片…', cards: [] },
  penalty: { tag: 'VIOLATIONS & PENALTIES', title: '发货违规及处罚', desc: '正在加载规则卡片…', cards: [] }
};

function applyCuratedCardsPayload(data) {
  if (!data) {
    RULES_DATA = RULES_DATA_FALLBACK;
    return;
  }
  RULES_DATA = {
    shelf: data.shelf || RULES_DATA_FALLBACK.shelf,
    score: data.score || RULES_DATA_FALLBACK.score,
    ship: data.ship || RULES_DATA_FALLBACK.ship,
    penalty: data.penalty || RULES_DATA_FALLBACK.penalty
  };
}
applyCuratedCardsPayload(null);

const TIMELINE_DATA`;

async function patchFile(filePath) {
  const html = await readFile(filePath, "utf8");
  const start = html.indexOf("const RULES_DATA = ");
  const end = html.indexOf("\n};\n\nconst TIMELINE_DATA");
  if (start < 0 || end < 0) {
    throw new Error(`markers not found in ${filePath}`);
  }
  const out =
    html.slice(0, start) + REPLACEMENT + html.slice(end + "\n};\n\nconst TIMELINE_DATA".length);
  await writeFile(filePath, out, "utf8");
}

await patchFile("index.html");
await patchFile("public/index.html");
console.log("done");
