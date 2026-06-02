import path from "node:path";
import { fileURLToPath } from "node:url";

import { classifyRules } from "../src/services/classifier.js";
import { enrichRulesWithAiSummary } from "../src/services/llm/summarizer.js";
import { isLlmEnabled } from "../src/services/llm/client.js";
import { loadRules } from "../src/services/storage.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
const platform = platformArg ? platformArg.split("=")[1] : "tmall";

if (platform === "douyin" && !process.env.DATA_DIR) {
  process.env.DATA_DIR = path.join(repoRoot, "data", "douyin");
}
if (platform === "intl" && !process.env.DATA_DIR) {
  process.env.DATA_DIR = path.join(repoRoot, "data", "intl");
}

const weeklyScope =
  platform === "douyin" ? "douyin" : platform === "intl" ? "intl" : "tmall";

const rules = classifyRules(await loadRules(), { platform });

if (!isLlmEnabled()) {
  console.error(
    "LLM disabled: set ENABLE_LLM_SUMMARY=true and DEEPSEEK_API_KEY in environment."
  );
  process.exit(1);
}

const result = await enrichRulesWithAiSummary(rules, {
  previousRules: rules,
  persist: true,
  platform,
  weeklyScope
});

console.log(
  JSON.stringify(
    {
      ok: true,
      platform,
      weeklyScope,
      total: result.rules.length,
      summarized: result.summarized,
      skipped: result.skipped,
      errors: result.errors
    },
    null,
    2
  )
);
