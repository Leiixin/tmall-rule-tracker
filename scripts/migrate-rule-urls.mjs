import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRuleDetailUrl } from "../src/utils/ruleDetailUrl.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixUrl(value) {
  if (!value || typeof value !== "string") {
    return value;
  }
  const next = normalizeRuleDetailUrl(value);
  return next || value;
}

function walkUrls(value) {
  if (!value || typeof value !== "object") {
    return 0;
  }
  let n = 0;
  if (Array.isArray(value)) {
    for (const item of value) {
      n += walkUrls(item);
    }
    return n;
  }
  for (const [key, v] of Object.entries(value)) {
    if ((key === "url" || key === "link") && typeof v === "string") {
      const fixed = fixUrl(v);
      if (fixed !== v) {
        value[key] = fixed;
        n += 1;
      }
    } else if (v && typeof v === "object") {
      n += walkUrls(v);
    }
  }
  return n;
}

async function migrateFile(relPath) {
  const filePath = path.join(root, relPath);
  let raw;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    console.log("skip (missing)", relPath);
    return 0;
  }
  const data = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const count = walkUrls(data);
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("updated", relPath, "links:", count);
  return count;
}

async function syncPublicData() {
  const pairs = ["status.json", "scraped.json", "timeline.json"];
  const srcDir = path.join(root, "data");
  const destDir = path.join(root, "public", "data");
  await mkdir(destDir, { recursive: true });
  for (const name of pairs) {
    await copyFile(path.join(srcDir, name), path.join(destDir, name));
    console.log("synced public/data/" + name);
  }
}

const targets = ["data/rules.json", "data/scraped.json", "data/timeline.json"];

let total = 0;
for (const t of targets) {
  total += await migrateFile(t);
}
await syncPublicData();
console.log("done, fixed fields:", total);
