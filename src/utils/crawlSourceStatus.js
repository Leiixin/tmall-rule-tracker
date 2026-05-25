import { CRAWL_SOURCE_MANIFEST } from "../config.js";

export function emptySourcesUnknown() {
  const sources = {};
  for (const entry of CRAWL_SOURCE_MANIFEST) {
    sources[entry.label] = { status: "unknown", lastCheck: null };
  }
  return sources;
}

export function buildSourcesFromReport(report, timestamp) {
  const byId = new Map((report || []).map((row) => [row.id, row]));
  const sources = {};

  for (const entry of CRAWL_SOURCE_MANIFEST) {
    const row = byId.get(entry.id);
    const status = row?.status || "unknown";
    const item = {
      status,
      lastCheck: timestamp || null
    };
    if (row && typeof row.count === "number") {
      item.count = row.count;
    }
    if (row?.message) {
      item.message = row.message;
    }
    sources[entry.label] = item;
  }

  return sources;
}

export function buildErrorReport(message) {
  return CRAWL_SOURCE_MANIFEST.map((entry) => ({
    id: entry.id,
    label: entry.label,
    status: "error",
    count: 0,
    message: message || "抓取失败"
  }));
}
