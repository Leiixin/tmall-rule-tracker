/**
 * Unit-style checks for curated change detection.
 * Run: node scripts/test-curated-change-detection.mjs
 */
import {
  contentHash,
  detectCuratedSourceChange,
  extractBodyPublicationFingerprint,
  normalizeWatchIso
} from "../src/utils/curatedChangeDetection.js";

let failed = 0;

function assert(condition, label) {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error("FAIL:", label);
    failed += 1;
  } else {
    // eslint-disable-next-line no-console
    console.log("ok:", label);
  }
}

assert(
  normalizeWatchIso("2026-05-26T12:20:26.123Z") ===
    normalizeWatchIso("2026-05-26T12:20:26.000Z"),
  "normalizeWatchIso truncates to seconds"
);

const sample =
  "现进行规则公示，公示期：2026年5月26日-2026年6月2日。规则预计于2026年6月2日生效。";
const fp1 = extractBodyPublicationFingerprint("修订通知", sample);
assert(fp1.includes("publicity:2026-05-26..2026-06-02"), "extract publicity range");
assert(fp1.includes("effective:2026-06-02"), "extract effective date");

const prev = {
  contentHash: contentHash(sample),
  platformModifiedAt: "2026-05-26T12:00:00.000Z",
  bodyPublicationFingerprint: fp1
};
const same = detectCuratedSourceChange(prev, {
  title: "修订通知",
  content: sample,
  publishedAt: "2026-05-26T12:00:00.000Z"
});
assert(!same.changed, "no change when snapshot identical");

const dateShift = detectCuratedSourceChange(prev, {
  title: "修订通知",
  content: sample,
  publishedAt: "2026-05-27T12:00:00.000Z"
});
assert(
  dateShift.changed && dateShift.reasons.includes("platformModifiedAt changed"),
  "platformModifiedAt change triggers"
);

const bodyDateShift = detectCuratedSourceChange(prev, {
  title: "修订通知",
  content:
    "现进行规则公示，公示期：2026年5月26日-2026年6月2日。规则预计于2026年6月3日生效。",
  publishedAt: "2026-05-26T12:00:00.000Z"
});
assert(
  bodyDateShift.changed &&
    bodyDateShift.reasons.includes("body publication dates changed"),
  "body effective date change triggers"
);

const hashShift = detectCuratedSourceChange(prev, {
  title: "修订通知",
  content: `${sample} 新增处罚条款。`,
  publishedAt: "2026-05-26T12:00:00.000Z"
});
assert(
  hashShift.changed && hashShift.reasons.includes("contentHash changed"),
  "contentHash change triggers"
);

const first = detectCuratedSourceChange({}, {
  title: "修订通知",
  content: sample,
  publishedAt: "2026-05-26T12:00:00.000Z"
});
assert(first.changed && first.reasons.includes("first watch"), "first watch triggers");

const nullToDate = detectCuratedSourceChange(
  { contentHash: "abc", platformModifiedAt: null },
  { content: "x", publishedAt: "2026-01-01T00:00:00.000Z" }
);
assert(
  nullToDate.changed &&
    nullToDate.reasons.includes("platformModifiedAt changed"),
  "null platformModifiedAt to value triggers"
);

if (failed > 0) {
  // eslint-disable-next-line no-console
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("\nAll curated change detection checks passed.");
