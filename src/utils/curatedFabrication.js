/**
 * Curated card body vs rule source text — heuristic grounding checks.
 * Verdicts: supported | simplified | fabricated | source_unavailable
 */

const FABRICATED_IF_ABSENT_IN_SOURCE = [
  { re: /新风潮/u, note: "活动专名" },
  { re: /3\s*\+\s*2\s*[×x*]\s*排名百分位/u, note: "3+2×排名百分位公式" },
  { re: /[−－-]\s*0\.\d+\s*分/u, note: "具体扣分数值" },
  { re: /排名百分位/u, note: "排名百分位表述" }
];

const INTERPRETATION_MARKERS = [
  /越优/u,
  /越好/u,
  /越差/u,
  /形成负向循环/u,
  /前\d+%/u,
  /目标[：:]/u
];

export function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseLiItems(body) {
  const items = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(String(body || "")))) {
    const text = stripHtml(m[1]);
    if (text) {
      items.push(text);
    }
  }
  return items;
}

export function normalizeForMatch(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .replace(/[，,。．.；;：:、]/g, "")
    .toLowerCase();
}

/** Significant numbers (days, rule ids) — ignore 2-digit date fragments like 03 from 2026-03-05 */
export function extractSignificantNumbers(text) {
  const found = new Set();
  const raw = String(text || "");
  const re = /(\d{3,8}(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(raw))) {
    found.add(m[1]);
  }
  return [...found];
}

function numberAppearsInSource(num, source) {
  if (!num || !source) {
    return false;
  }
  if (source.includes(num)) {
    return true;
  }
  const alt = num.replace(/\.0+$/, "");
  if (alt !== num && source.includes(alt)) {
    return true;
  }
  // 2026-02-24 vs 2026年2月24日
  if (/^\d{4}$/.test(num)) {
    return source.includes(num);
  }
  if (/^\d{8}$/.test(num)) {
    return source.includes(num);
  }
  return false;
}

function charBigramSet(text) {
  const norm = normalizeForMatch(text).replace(/[^\u4e00-\u9fa5a-z0-9]/gi, "");
  const set = new Set();
  for (let i = 0; i < norm.length - 1; i++) {
    set.add(norm.slice(i, i + 2));
  }
  return set;
}

function bigramOverlapRatio(li, source) {
  const a = charBigramSet(li);
  if (!a.size) {
    return 1;
  }
  const b = charBigramSet(source);
  let hit = 0;
  for (const bg of a) {
    if (b.has(bg)) {
      hit += 1;
    }
  }
  return hit / a.size;
}

function hasFabricatedPattern(li, source) {
  for (const { re, note } of FABRICATED_IF_ABSENT_IN_SOURCE) {
    if (re.test(li) && !re.test(source)) {
      return note;
    }
  }
  if (/同行排名/u.test(li) && /得分档位/u.test(source) && !/同行排名/u.test(source)) {
    return "正文为得分档位标准，非同行排名";
  }
  if (/品质退款.*支付订单/u.test(li) && /物流签收/u.test(source)) {
    return "负反馈率分母应为物流签收订单，非支付订单量";
  }
  if (/自然好评/u.test(li) && !/自然好评/u.test(source)) {
    return "好评率公式含正文未出现的「自然好评」";
  }
  return null;
}

/**
 * @param {string} li
 * @param {string} sourceContent
 * @returns {{ verdict: string, reason: string }}
 */
export function auditLiAgainstSource(li, sourceContent) {
  if (!sourceContent || !String(sourceContent).trim()) {
    return { verdict: "source_unavailable", reason: "无规则正文" };
  }

  const patternNote = hasFabricatedPattern(li, sourceContent);
  if (patternNote) {
    return { verdict: "fabricated", reason: patternNote };
  }

  const nums = extractSignificantNumbers(li);
  const missingNums = nums.filter((n) => !numberAppearsInSource(n, sourceContent));

  const overlap = bigramOverlapRatio(li, sourceContent);
  const isInterpretation = INTERPRETATION_MARKERS.some((re) => re.test(li));

  if (missingNums.length > 0 && nums.length >= 1) {
    return {
      verdict: "fabricated",
      reason: `数字 ${missingNums.join("、")} 未在规则正文中出现`
    };
  }

  if (overlap < 0.12 && li.length >= 12) {
    return { verdict: "fabricated", reason: "与规则正文关键词重叠过低" };
  }

  if (isInterpretation || overlap < 0.38 || /平台相关/u.test(li)) {
    return {
      verdict: "simplified",
      reason: isInterpretation
        ? "运营解读性表述"
        : overlap < 0.38
          ? "表述简化，建议对照原文核对"
          : "笼统概括，未逐条引用原文"
    };
  }

  return { verdict: "supported", reason: "要点可在规则正文中找到依据" };
}

export function worstVerdict(verdicts) {
  const rank = {
    source_unavailable: 4,
    fabricated: 3,
    simplified: 2,
    supported: 1
  };
  let worst = "supported";
  for (const v of verdicts) {
    if ((rank[v] || 0) > (rank[worst] || 0)) {
      worst = v;
    }
  }
  return worst;
}

export function summarizeCardAudit(liResults) {
  const verdicts = liResults.map((r) => r.verdict);
  const cardVerdict = worstVerdict(verdicts);
  const fabricated = liResults.filter((r) => r.verdict === "fabricated");
  const simplified = liResults.filter((r) => r.verdict === "simplified");
  return { cardVerdict, fabricated, simplified, liResults };
}
