import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { classifyRules } from "../src/services/classifier.js";
import { enrichRulesWithAiSummary } from "../src/services/llm/summarizer.js";
import { isLlmEnabled } from "../src/services/llm/client.js";
import { loadRules } from "../src/services/storage.js";

function loadDotEnv() {
  const envPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".env"
  );
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const platformArg = process.argv.find((arg) => arg.startsWith("--platform="));
const platform = platformArg ? platformArg.split("=")[1] : "tmall";
const weeklyOnly = process.argv.includes("--weekly-only");

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
    "LLM disabled: set ENABLE_LLM_SUMMARY=true and DEEPSEEK_API_KEY in .env or environment."
  );
  process.exit(1);
}

const result = await enrichRulesWithAiSummary(rules, {
  previousRules: rules,
  persist: true,
  platform,
  weeklyScope,
  weeklyOnly
});

const dataRulesPath =
  platform === "douyin"
    ? path.join(repoRoot, "data", "douyin", "rules.json")
    : platform === "intl"
      ? path.join(repoRoot, "data", "intl", "rules.json")
      : path.join(repoRoot, "data", "rules.json");
const publicRulesPath =
  platform === "douyin"
    ? path.join(repoRoot, "public", "data", "douyin", "rules.json")
    : platform === "intl"
      ? path.join(repoRoot, "public", "data", "intl", "rules.json")
      : path.join(repoRoot, "public", "data", "rules.json");
await mkdir(path.dirname(publicRulesPath), { recursive: true });
await copyFile(dataRulesPath, publicRulesPath);

console.log(
  JSON.stringify(
    {
      ok: true,
      platform,
      weeklyScope,
      weeklyOnly,
      total: result.rules.length,
      summarized: result.summarized,
      skipped: result.skipped,
      errors: result.errors,
      syncedTo: publicRulesPath
    },
    null,
    2
  )
);
