import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isDouyinAnnouncementLikeSource,
  isIntlAnnouncementLikeSource,
  isRuleInWeeklyWindow
} from "../src/utils/weeklyEligibility.js";
import { registerPlatformMatchers } from "../src/utils/rulePlatformScope.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

function getLastWeekRange(ref) {
  const d = new Date(ref);
  const day = d.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(d);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(d.getDate() - daysFromMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  return { start: lastMonday, end: lastSunday };
}

const manifest = JSON.parse(
  await readFile(path.join(repoRoot, "data", "platforms.json"), "utf8")
);
registerPlatformMatchers(manifest);

const range = getLastWeekRange(new Date("2026-06-02"));

assert(
  isDouyinAnnouncementLikeSource({
    source: "抖音电商规则中心（公示通知）"
  }),
  "公示通知 source should match"
);
assert(
  !isDouyinAnnouncementLikeSource({ source: "抖音电商规则中心" }),
  "catalog source should not match"
);

const catalogInWeek = {
  platformScope: "douyin",
  source: "抖音电商规则中心",
  url: "https://school.jinritemai.com/doudian/web/rules/101821",
  publishedAt: "2026-05-28T10:00:00.000Z",
  lastSeenAt: "2026-06-02T10:00:00.000Z"
};
assert(
  !isRuleInWeeklyWindow(catalogInWeek, range, "douyin"),
  "catalog rule should be excluded"
);

assert(
  isIntlAnnouncementLikeSource({
    source: "天猫国际（rule.tmall.hk / MTOP）（规则公示）"
  }),
  "intl publicity source should match"
);
const intlCatalog = {
  platformScope: "intl",
  source: "天猫国际（rule.tmall.hk / MTOP）",
  url: "https://rule.tmall.hk/?type=detail&ruleId=11005234",
  publishedAt: "2026-05-28T10:00:00.000Z",
  lastSeenAt: "2026-06-02T10:00:00.000Z"
};
assert(
  !isRuleInWeeklyWindow(intlCatalog, range, "intl"),
  "intl general catalog should be excluded from weekly"
);

const rules = JSON.parse(
  (await readFile(path.join(repoRoot, "data", "douyin", "rules.json"), "utf8")).replace(
    /^\uFEFF/,
    ""
  )
);
const douyinWeekly = rules.filter((r) =>
  isRuleInWeeklyWindow(r, range, "douyin")
);
const oldStyle = rules.filter((r) => {
  const inRange = (iso) => {
    if (!iso) return false;
    const t = new Date(iso);
    return !Number.isNaN(t.getTime()) && t >= range.start && t <= range.end;
  };
  return (
    r.platformScope === "douyin" &&
    (inRange(r.publishedAt) || inRange(r.lastSeenAt))
  );
});

console.log(
  JSON.stringify(
    {
      ok: true,
      douyinWeeklyTotal: douyinWeekly.length,
      oldFilterCount: oldStyle.length
    },
    null,
    2
  )
);
