import json
from datetime import datetime, timedelta
from pathlib import Path

repo_root = Path(__file__).resolve().parents[1]
HL = 'class="highlight"'


def get_last_week_range(reference=None):
    ref = reference or datetime.now()
    day_of_week = ref.weekday()
    this_monday = (ref - timedelta(days=day_of_week)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    last_monday = this_monday - timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return last_monday, last_sunday


def in_last_week(iso, start, end):
    if not iso:
        return False
    try:
        t = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        if t.tzinfo:
            t = t.replace(tzinfo=None)
    except ValueError:
        return False
    return start <= t <= end


def is_douyin_weekly(rule, start, end):
    source = str(rule.get("source") or "")
    if rule.get("weeklyChannel") == "announcement":
        return in_last_week(rule.get("publishedAt"), start, end)
    if not any(k in source for k in ("规则动态", "公示通知", "首页推荐")):
        return False
    return in_last_week(rule.get("publishedAt"), start, end)


def is_tmall_weekly(rule, start, end):
    return in_last_week(rule.get("publishedAt"), start, end) or in_last_week(
        rule.get("lastSeenAt"), start, end
    )


def check(rel_path: str, weekly_scope: str):
    rules = json.loads((repo_root / rel_path).read_text(encoding="utf-8-sig"))
    start, end = get_last_week_range()
    miss = tot = 0
    weekly_count = 0
    for rule in rules:
        ai = rule.get("aiSummary") or {}
        if not ai:
            continue
        if weekly_scope == "douyin":
            if not is_douyin_weekly(rule, start, end):
                continue
        else:
            if not is_tmall_weekly(rule, start, end):
                continue
        weekly_count += 1
        for field in ("highlightsStructured", "impactsStructured"):
            st = ai.get(field) or {}
            for items in st.values():
                if not isinstance(items, list):
                    continue
                for point in items:
                    tot += 1
                    if HL not in str(point):
                        miss += 1
    return {
        "file": rel_path,
        "weeklyRules": weekly_count,
        "miss": miss,
        "tot": tot,
    }


if __name__ == "__main__":
    ok = True
    for rel, scope in (
        ("public/data/rules.json", "tmall"),
        ("public/data/douyin/rules.json", "douyin"),
    ):
        r = check(rel, scope)
        passed = r["miss"] == 0 or r["tot"] == 0
        print(
            f"{'OK' if passed else 'FAIL'}: {r['file']} weekly={r['weeklyRules']} missing={r['miss']}/{r['tot']}"
        )
        ok = ok and passed
    raise SystemExit(0 if ok else 1)
