import { writeFile } from "node:fs/promises";
const BASE = "https://school.jinritemai.com";
const id = "101706";
const u = new URL("/api/eschool/v2/library/article/detail", BASE);
u.searchParams.set("id", id);
u.searchParams.set("graphId", "312");
u.searchParams.set("need_content", "true");
const r = await fetch(u, {
  headers: {
    Accept: "application/json",
    Referer: `${BASE}/doudian/web/article/${id}`,
    Origin: BASE
  }
});
const j = await r.json();
const c = j.data?.article_info?.content || "";
const s = typeof c === "string" ? c : JSON.stringify(c);
const article = [...new Set([...s.matchAll(/article\/([a-zA-Z0-9]+)/g)].map((m) => m[1]))];
const rules = [...new Set([...s.matchAll(/rules\/([0-9]+)/g)].map((m) => m[1]))];
console.log({ article, rules, len: s.length });
await writeFile("tmp-101706-links.json", JSON.stringify({ article, rules }, null, 2));
