const BASE = "https://school.jinritemai.com";
const ids = [
  "aHwH9wK4JUHQ",
  "aHwH9wK4Je2N",
  "aHwHGWzbmk88",
  "aHwHroCPheig",
  "aHzmeN9E9dBF",
  "aHwH9wK4JyWJ",
  "101652",
  "101834",
  "113124",
  "aHGTzApWkqH6"
];

async function titleOf(id) {
  const u = new URL("/api/eschool/v2/library/article/detail", BASE);
  u.searchParams.set("id", id);
  u.searchParams.set("graphId", "312");
  u.searchParams.set("need_content", "false");
  const r = await fetch(u, {
    headers: { Accept: "application/json", Referer: `${BASE}/doudian/web/article/${id}`, Origin: BASE }
  });
  const j = await r.json();
  return j.data?.article_info?.name || j.msg || "err";
}

for (const id of ids) {
  const name = await titleOf(id);
  console.log(id, "|", (name || "").replace(/\s+/g, " ").slice(0, 100));
}
