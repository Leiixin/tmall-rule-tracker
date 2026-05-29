import { PLATFORM_CRAWL_MANIFESTS } from "../config.js";

function resolveManifest(platform) {
  return PLATFORM_CRAWL_MANIFESTS[platform] || PLATFORM_CRAWL_MANIFESTS.tmall;
}

export function emptySourcesUnknown(platform = "tmall") {
  const manifest = resolveManifest(platform);
  const sources = {};
  for (const entry of manifest) {
    sources[entry.label] = { status: "unknown", lastCheck: null };
  }
  return sources;
}

export function buildSourcesFromReport(report, timestamp, platform = "tmall") {
  const manifest = resolveManifest(platform);
  const byId = new Map((report || []).map((row) => [row.id, row]));
  const sources = {};

  for (const entry of manifest) {
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

export function buildErrorReport(message, platform = "tmall") {
  const manifest = resolveManifest(platform);
  return manifest.map((entry) => ({
    id: entry.id,
    label: entry.label,
    status: "error",
    count: 0,
    message: message || "抓取失败"
  }));
}
