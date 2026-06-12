import json
import re
from pathlib import Path

repo_root = Path(__file__).resolve().parents[1]


def strip_broken_html_tail(text: str) -> str:
    t = str(text or "")
    open_idx = t.rfind("<span")
    if open_idx != -1 and t.find("</span>", open_idx) == -1:
        t = t[:open_idx].strip()
    for pat in (
        r"<span[^>]*$",
        r"</?span[^>]*$",
        r"</?sp(?:an)?[^>]*$",
        r"<[^>]*$",
    ):
        t = re.sub(pat, "", t, flags=re.I)
    return t.strip()


def normalize_weekly_span_markup(text: str) -> str:
    t = re.sub(
        r"<span class='(num|highlight)'>([\s\S]*?)</span>",
        r'<span class="\1">\2</span>',
        str(text or ""),
        flags=re.I,
    )
    return strip_broken_html_tail(t)


def looks_truncated(text: str) -> bool:
    t = str(text or "")
    return bool(re.search(r"以<$|</sp(?:an)?$|<span[^>]*$|<[^>]*$", t, re.I))


def repair_structured(structured):
    truncated = False
    if not isinstance(structured, dict):
        return structured, truncated
    out = {}
    for key, items in structured.items():
        if not isinstance(items, list):
            continue
        out[key] = []
        for point in items:
            raw = str(point or "")
            if looks_truncated(raw):
                truncated = True
            out[key].append(normalize_weekly_span_markup(raw))
    return out, truncated


SECTION_KEYS = {
    "highlightsStructured": ["核心变化", "适用范围", "生效时间"],
    "impactsStructured": ["不利", "有利", "中性"],
    "actionsStructured": ["运营组", "客服组", "物流组"],
}


def flatten(structured, keys):
    flat = []
    if not isinstance(structured, dict):
        return flat
    for key in keys:
        for point in structured.get(key, []) or []:
            text = str(point or "").strip()
            if text:
                flat.append(f"{key}：{text[:200]}")
    return flat


def repair_file(rel_path: str):
    path = repo_root / rel_path
    rules = json.loads(path.read_text(encoding="utf-8-sig"))
    rules_truncated = 0
    for rule in rules:
        ai = rule.get("aiSummary")
        if not ai:
            continue
        rule_truncated = False
        for field, keys in SECTION_KEYS.items():
            if ai.get(field):
                ai[field], truncated = repair_structured(ai[field])
                rule_truncated |= truncated
        if ai.get("highlightsStructured"):
            ai["highlights"] = flatten(
                ai["highlightsStructured"], SECTION_KEYS["highlightsStructured"]
            )
        elif ai.get("highlights"):
            ai["highlights"] = [
                normalize_weekly_span_markup(x) for x in ai["highlights"]
            ]
        if ai.get("impactsStructured"):
            ai["impacts"] = flatten(
                ai["impactsStructured"], SECTION_KEYS["impactsStructured"]
            )
        elif ai.get("impacts"):
            ai["impacts"] = [normalize_weekly_span_markup(x) for x in ai["impacts"]]
        if ai.get("actionsStructured"):
            ai["actions"] = flatten(
                ai["actionsStructured"], SECTION_KEYS["actionsStructured"]
            )
        elif ai.get("actions"):
            ai["actions"] = [normalize_weekly_span_markup(x) for x in ai["actions"]]
        if ai.get("highlight"):
            ai["highlight"] = normalize_weekly_span_markup(ai["highlight"])
        if rule_truncated:
            rules_truncated += 1
            ai.pop("contentHash", None)
    path.write_text(
        "\ufeff" + json.dumps(rules, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return {
        "file": rel_path,
        "rules": len(rules),
        "need_resummarize": rules_truncated,
    }


if __name__ == "__main__":
    results = [
        repair_file("data/rules.json"),
        repair_file("public/data/rules.json"),
    ]
    print(json.dumps({"ok": True, "results": results}, ensure_ascii=False, indent=2))
