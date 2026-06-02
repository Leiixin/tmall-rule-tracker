# 抖音电商规则中心 — 抓包结论

数据源：[school.jinritemai.com/doudian/web/rules](https://school.jinritemai.com/doudian/web/rules)

## 可用 BFF（GET，无需登录）

| 用途 | 路径 | 说明 |
|------|------|------|
| 规则中心首页 | `/api/eschool/v1/rule/center/main?new_rule_num={n}&violation_num=6` | `rule_module`、`latest_rule`、`violations`（**不再**用 `new_rules` 作规则动态） |
| **规则动态栏目** `/doudian/web/rules/11688` | `/api/eschool/v1/rule/list?rule_type=0&direction=2&page=&page_size=` | Referer 设为栏目 URL；`total`≈3300+；爬虫默认 **10 页**（约 500 条） |
| 公示/征集（与栏目 list 同源，已合并） | 同上 `rule/list` | 与栏目 11688 列表 API 相同，避免重复分页 |
| 栏目节点（可选） | `/api/eschool/v2/library/article/list?node_id=11688` | `total`≈367，与栏目路由 ID 一致，可作子集参考 |
| 规则库列表 | `/api/eschool/v2/library/article/list?node_id=7236&page=&page_size=` | 生产根节点 `7236`，`total`≈12744 |
| 规则正文 | `/api/eschool/v2/library/article/detail?id={id}&graphId=312&need_content=true` | `article_info.content` 为 Delta JSON |

## URL 规范

- 规则详情页：`https://school.jinritemai.com/doudian/web/rules/{id}`
- `id` 可为数字（如 `113312`）或 slug（如 `aHVWKjDmNiUv`）

## 请求头

```
User-Agent: Mozilla/5.0 ...
Referer: https://school.jinritemai.com/doudian/web/rules
Origin: https://school.jinritemai.com
Accept: application/json
```

## 常量

- `graphId`: 312
- 生产环境根 `node_id`: 7236（前端 `E.OB.isProd ? 7236 : 3797`）

## 正文解析

`content` 字段为 Lark/Quill Delta JSON（`deltas.*.ops[].insert`），需提取 `insert` 文本拼接为纯文本。

## 风险与兜底

- 部分 slug 可能失效（如历史链接 `nHVrThC4CVeC` 返回 `objID is empty`）
- 全量 1.2 万+ 规则不宜逐条拉正文；爬虫仅对近期更新拉详情（`MAX_DETAIL_FETCH`）
- 单条失败可使用 `data/douyin/rule-text/rule-{slug}.txt` 手工兜底（curated sync）

## 前端 bundle 定位

- 入口：`fe-eschool-web/index.*.js`
- 规则页 chunk：`async/pages-Rules.{hash}.js`

## 日常回归探测

栏目 11688 列表 API 是否与爬虫一致，请运行：

```bash
npm run probe:douyin:section
```

（对应 [`scripts/probe-douyin-section-11688.mjs`](../scripts/probe-douyin-section-11688.mjs)）
