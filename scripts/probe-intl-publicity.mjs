/**
 * 探测 rule.tmall.hk 规则公示栏 MTOP list 参数。
 * 运行: node scripts/probe-intl-publicity.mjs
 */
import { probeIntlPublicityListVariants } from "../src/crawler/tmallCrawler.js";

const targetRuleId = process.argv[2] || "20010186";
const result = await probeIntlPublicityListVariants(targetRuleId);
// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));
