import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerPlatformMatchers, ruleMatchesWeeklyScope } from "../src/utils/rulePlatformScope.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const platforms = JSON.parse(
  await readFile(path.join(repoRoot, "data", "platforms.json"), "utf8")
);
registerPlatformMatchers(platforms);

function parseJson(text) {
  return JSON.parse(String(text).replace(/^\uFEFF/, ""));
}

const rules = parseJson(
  await readFile(path.join(repoRoot, "data", "douyin", "rules.json"), "utf8")
);

const douyinRules = rules.filter((r) => ruleMatchesWeeklyScope(r, "douyin"));
console.log("total rules", rules.length, "douyin scope", douyinRules.length);
console.log("sample", douyinRules[0]?.title);

const status = parseJson(
  await readFile(path.join(repoRoot, "data", "douyin", "status.json"), "utf8")
);
const timeline = parseJson(
  await readFile(path.join(repoRoot, "data", "douyin", "timeline.json"), "utf8")
);
const scraped = parseJson(
  await readFile(path.join(repoRoot, "data", "douyin", "scraped.json"), "utf8")
);

console.log("status platform", status.platform, "total", status.totalRules);
console.log("timeline items", timeline.items?.length);
console.log(
  "scraped buckets",
  Object.fromEntries(
    Object.entries(scraped.categorized || {}).map(([k, v]) => [k, v.length])
  )
);

const { fetchDouyinRuleDetailForCurated } = await import("../src/crawler/douyinCrawler.js");
const detail = await fetchDouyinRuleDetailForCurated({
  slug: "aHVWKjDmNiUv",
  url: "https://school.jinritemai.com/doudian/web/rules/aHVWKjDmNiUv",
  platform: "douyin"
});
console.log("curated detail", detail?.title, detail?.content?.length > 100);
