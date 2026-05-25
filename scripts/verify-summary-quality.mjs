/**
 * 验收周度 aiSummary 是否满足 prompt v6 关键字段（贴坏包赔样例）。
 * 用法：node scripts/verify-summary-quality.mjs
 */
import { readFileSync } from "node:fs";
import {
  highlightsMissBreachPromiseRule,
  summaryMissRedPacketCompensation
} from "../src/utils/summaryQuality.js";

const rules = JSON.parse(
  readFileSync(new URL("../data/rules.json", import.meta.url), "utf8").replace(
    /^\uFEFF/,
    ""
  )
);
const rule = rules.find((r) => r.title?.includes("贴坏包赔"));
if (!rule?.aiSummary) {
  console.error("FAIL: 贴坏包赔 rule or aiSummary not found");
  process.exit(1);
}

const s = rule.aiSummary;
const core = (s.highlightsStructured?.["核心变化"] || []).join("\n");
const adverse = (s.impactsStructured?.["不利"] || []).join("\n");
const blob = core + adverse;

const checks = [
  ["promptVersion 6", s.promptVersion === "6"],
  ["违背承诺规则全称", /违背承诺的规则及实施细则/.test(blob)],
  ["24小时响应", /24.*小时.*响应/.test(core)],
  ["24小时发货", /24.*小时.*发/.test(core)],
  ["5天未寄出", /5\s*天/.test(blob)],
  ["30元赔付红包", /30.*元|赔付红包/.test(blob)],
  ["quality: breach rule", !highlightsMissBreachPromiseRule(rule, s)],
  ["quality: red packet", !summaryMissRedPacketCompensation(rule, s)]
];

let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "OK" : "FAIL"}: ${name}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
