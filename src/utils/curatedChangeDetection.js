import { createHash } from "node:crypto";

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function contentHash(text) {
  return createHash("sha256")
    .update(String(text || ""))
    .digest("hex")
    .slice(0, 16);
}

/** Normalize ISO timestamps for stable equality (second precision, UTC). */
export function normalizeWatchIso(iso) {
  if (!iso) {
    return "";
  }
  const t = Date.parse(String(iso));
  if (Number.isNaN(t)) {
    return String(iso).trim();
  }
  return new Date(Math.floor(t / 1000) * 1000).toISOString();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(y, mo, d) {
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (!year || !month || !day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseChineseDateMatch(m) {
  return toDateKey(m[1], m[2], m[3]);
}

const REVISION_PATTERNS = [
  /于\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*修订/g,
  /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*修订/g,
  /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日号]?\s*修订/g
];

const EFFECTIVE_PATTERNS = [
  /预计于\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*生效/g,
  /规则预计于\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*生效/g,
  /于\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*起生效/g,
  /自\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*起施行/g,
  /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*起生效/g,
  /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日号]?\s*起生效/g
];

const PUBLICITY_RANGE_RE =
  /公示期[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*[-～至到]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g;

function collectLatestDate(text, patterns) {
  let latest = null;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const key = parseChineseDateMatch(m);
      if (!key) {
        continue;
      }
      if (!latest || key > latest) {
        latest = key;
      }
    }
  }
  return latest;
}

function collectPublicityRanges(text) {
  const ranges = [];
  PUBLICITY_RANGE_RE.lastIndex = 0;
  let m;
  while ((m = PUBLICITY_RANGE_RE.exec(text)) !== null) {
    const start = toDateKey(m[1], m[2], m[3]);
    const end = toDateKey(m[4], m[5], m[6]);
    if (start && end) {
      ranges.push(`${start}..${end}`);
    }
  }
  return ranges.sort();
}

/**
 * Canonical fingerprint of publication-related dates mentioned in rule text.
 */
export function extractBodyPublicationFingerprint(title, content) {
  const text = normalizeText(`${title || ""} ${content || ""}`);
  if (!text) {
    return "";
  }

  const parts = [];
  const revision = collectLatestDate(text, REVISION_PATTERNS);
  if (revision) {
    parts.push(`revision:${revision}`);
  }

  for (const range of collectPublicityRanges(text)) {
    parts.push(`publicity:${range}`);
  }

  const effective = collectLatestDate(text, EFFECTIVE_PATTERNS);
  if (effective) {
    parts.push(`effective:${effective}`);
  }

  return parts.join("|");
}

/**
 * @param {object} prev - prior watch.sources[id] entry (may be empty)
 * @param {{ title?: string, content?: string, publishedAt?: string|null }} detail
 */
export function detectCuratedSourceChange(prev, detail) {
  const prevWatch = prev || {};
  const hash = contentHash(detail?.content);
  const platformModifiedAt = detail?.publishedAt || null;
  const bodyPublicationFingerprint = extractBodyPublicationFingerprint(
    detail?.title,
    detail?.content
  );

  const snapshot = {
    contentHash: hash,
    platformModifiedAt,
    bodyPublicationFingerprint
  };

  const reasons = [];

  if (!prevWatch.contentHash) {
    reasons.push("first watch");
  }
  if (prevWatch.contentHash && prevWatch.contentHash !== hash) {
    reasons.push("contentHash changed");
  }
  if (
    normalizeWatchIso(prevWatch.platformModifiedAt) !==
    normalizeWatchIso(platformModifiedAt)
  ) {
    reasons.push("platformModifiedAt changed");
  }
  if (
    (prevWatch.bodyPublicationFingerprint || "") !== bodyPublicationFingerprint
  ) {
    if (prevWatch.contentHash) {
      reasons.push("body publication dates changed");
    }
  }

  return {
    changed: reasons.length > 0,
    reasons,
    snapshot
  };
}
