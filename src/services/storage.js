import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "rules.json");

export async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, "[]", "utf8");
  }
}

export async function loadRules() {
  await ensureDataFile();
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRules(rules) {
  await ensureDataFile();
  await writeFile(dataFile, JSON.stringify(rules, null, 2), "utf8");
}

function ruleKey(rule) {
  if (rule.url) {
    return rule.url;
  }
  return `${rule.title || ""}|${rule.source || ""}|${rule.publishedAt || ""}`;
}

export async function upsertRules(incomingRules) {
  const current = await loadRules();
  const map = new Map(current.map((rule) => [ruleKey(rule), rule]));

  for (const rule of incomingRules) {
    const key = ruleKey(rule);
    const existing = map.get(key);

    map.set(key, {
      ...existing,
      ...rule,
      firstSeenAt: existing?.firstSeenAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
  }

  const merged = [...map.values()].sort((a, b) => {
    const aTime = new Date(a.publishedAt || a.lastSeenAt || 0).getTime();
    const bTime = new Date(b.publishedAt || b.lastSeenAt || 0).getTime();
    return bTime - aTime;
  });

  await saveRules(merged);
  return merged;
}
