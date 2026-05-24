/**
 * One-time: write sanitized score insights to curated-category-insights.json
 * and copy to public/data. Safe to re-run (overwrites score block only).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function main() {
  const root = process.cwd();
  const dataPath = path.join(root, "data", "curated-category-insights.json");
  const templatePath = path.join(root, "data", "curated-category-insights.json");

  const existing = await readJson(dataPath, { version: 1, categories: {} });
  const seeded = await readJson(templatePath, existing);

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: {
      ...existing.categories,
      score: seeded.categories?.score || existing.categories?.score
    }
  };

  await writeJson(dataPath, payload);
  await writeJson(path.join(root, "public", "data", "curated-category-insights.json"), payload);
  // eslint-disable-next-line no-console
  console.log("[migrate-score-insights] wrote score insights to data/ and public/data/");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
