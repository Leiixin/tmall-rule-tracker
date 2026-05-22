import { classifyRules } from "../src/services/classifier.js";
import { enrichRulesWithAiSummary } from "../src/services/llm/summarizer.js";
import { isLlmEnabled } from "../src/services/llm/client.js";
import { loadRules } from "../src/services/storage.js";

const rules = classifyRules(await loadRules());

if (!isLlmEnabled()) {
  console.error(
    "LLM disabled: set ENABLE_LLM_SUMMARY=true and DEEPSEEK_API_KEY in environment."
  );
  process.exit(1);
}

const result = await enrichRulesWithAiSummary(rules, {
  previousRules: rules,
  persist: true
});

console.log(
  JSON.stringify(
    {
      ok: true,
      total: result.rules.length,
      summarized: result.summarized,
      skipped: result.skipped,
      errors: result.errors
    },
    null,
    2
  )
);
