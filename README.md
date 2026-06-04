# 天猫规则监控中心（本地运行版）

## 项目说明
本项目是一个本地可运行的网站，核心页面来自根目录的 `index.html`，运行后由 Node 服务托管到：

`http://localhost:3000`

线上 GitHub Pages 顶栏会显示 **总访问（PV）** 与 **独立访客（UV）**，由 [不蒜子兼容 API](https://bsz.saop.cc/) 免费统计（按浏览器会话上报一次）。

当前页面会优先读取本地 JSON 数据进行展示：

- `data/status.json`
- `data/scraped.json`
- `data/timeline.json`

## 目录结构
- `src/server.js`：Node 服务入口
- `public/index.html`：实际被服务加载的页面文件
- `data/*.json`：页面读取的数据文件
- `scripts/*.ps1`：开机自启动安装/卸载脚本

## 快速启动
1. 安装依赖（首次或依赖缺失时）
```bash
npm install
```

2. 启动服务
```bash
npm run start
```

3. 浏览器打开
```text
http://localhost:3000
```

## 覆盖数据（你当前常用方式）
如果你更新了抓取结果，只需要替换下面三个文件即可：

- `data/status.json`
- `data/scraped.json`
- `data/timeline.json`

页面刷新后会重新读取最新内容。

## DeepSeek 周度解读（可选）

周度规则表格中的「重点内容 / 商家影响 / 流程建议」可接入 [DeepSeek](https://platform.deepseek.com/)（OpenAI 兼容 API）。摘要写入 `data/rules.json` 的 `aiSummary` 字段，正文未变时自动复用缓存。

输出格式（`promptVersion: 6`）：

- **highlightsStructured**：`核心变化` / `适用范围` / `生效时间`（处罚/服务承诺类须分条保留书名号规则名、时效、金额，禁止笼统「面临赔付风险」）
- **impactsStructured**：`不利` / `有利` / `中性`（经营后果与 highlights 处罚条呼应，不写各组动作）
- **actionsStructured**：`运营组` / `客服组` / `物流组`（可执行措施，含 24h/5 天等检查点，不与 impacts 重复）

三列均在页面渲染为「小标题 + 1.2.3. 分条」。旧版扁平 `impacts` / `actions` 数组会自动迁移为结构化展示。

修改提示词或升级 `PROMPT_VERSION`（当前为 **8**）后，需重跑 `npm run summarize`（或 `npm run crawl` / GitHub Actions）才会刷新旧 `aiSummary` 缓存。

1. 复制环境变量模板并填写 Key：
```bash
cp .env.example .env
# 编辑 .env：DEEPSEEK_API_KEY、ENABLE_LLM_SUMMARY=true
```

2. 本地仅补全已有规则摘要（不重新爬站）：
```bash
npm run summarize
```

3. 抓取时会顺带总结（天猫每次最多 `LLM_MAX_RULES_PER_RUN` 条，默认 20；**抖音周度**优先摘要上周公告，最多 `LLM_MAX_DOUYIN_WEEKLY` 条，默认 50）：
```bash
npm run crawl
npm run crawl:douyin
```

4. 仅补全抖音上周公告的 AI 解读（不重新爬站）：
```bash
npm run summarize:douyin
# 或
DATA_DIR=data/douyin node scripts/summarize-rules.mjs --platform=douyin
```

5. 校验抖音周度 AI 覆盖率：
```bash
npm run verify:douyin:weekly-llm
```

6. GitHub Actions：在 **Settings → Secrets and variables → Actions** 添加 `DEEPSEEK_API_KEY` 后，在 **Actions** 页手动运行 **Crawl Tmall Rules**，或等待每日定时任务；成功后 `data/rules.json` / `data/douyin/rules.json` 会出现 `aiSummary`。

未配置 Key 时行为与原先一致（snippet / 分类模板），不影响抓取。

## 分类页引用来源监控 + 自动更新卡片

四个分类 Tab（效期 / 体验分 / 发货时效 / 违规处罚）的**规则卡片**已外置到：

- `data/curated-cards.json`：页面展示用的卡片正文
- `data/curated-sources.json`：引用的天猫规则链接（按 `ruleId` 登记，可在 GitHub 编辑）
- `data/curated-watch.json`：定时任务写入的监测状态（平台修订时间、正文日期指纹、内容哈希、是否已自动同步）

**变更检测（天猫 / 抖音共用 `sync-curated-cards.mjs`）**：以下任一命中即标记 `changed`，并在 LLM 开启时入队 DeepSeek 重写：

1. 首次纳入监测
2. 正文 `contentHash` 变更
3. 链接规则 `platformModifiedAt`（API 发布时间）变更
4. 正文提到的公示/生效/修订日期指纹变更（`bodyPublicationFingerprint`）

**DeepSeek 卡片结构**（`CURATED_CARDS_PROMPT_VERSION` 当前为 **4**）：

- **效期 `shelf`**：阶段分卡；化妆品 / 隐形眼镜 / 保健品各独立成卡（原文有则写）
- **体验分 `score`**：大指标一卡，须含计算公式或计分逻辑
- **违规 `penalty`**：标题为具体违规行为，body 含认定条件 + 订单扣罚标准
- **抖音 penalty 实施细则**：标题仅违规类型名；body 为「认定：总括 + 认定①②… + 扣罚标准每条独立 li」（对齐天猫 penalty 格式）

```bash
npm run test:curated-change   # 变更检测单元检查
```

- `data/curated-category-insights.json`：分类页「规则变更记录 / 对商家的影响 / 优化策略建议」三栏数据（体验分 `pinned: true` 常驻；其余分类在监测到 `changed`/`synced` 且已有分析块时展示）

页面每个分类下有 **「引用来源维护」** 面板；若检测到原文变更，首页与分类页会显示横幅。配置 `DEEPSEEK_API_KEY` 后，GitHub Actions 会在变更时用 DeepSeek **自动重写**对应分类卡片，并生成变更分析写入 `curated-category-insights.json`（卡片每次最多 `LLM_MAX_CURATED_SOURCES_PER_RUN` 条来源，分析每次最多 `LLM_MAX_INSIGHTS_PER_RUN` 条来源，默认均为 2）。

```bash
# 首次从旧版内嵌数据导出（一般只需一次）
npm run migrate:curated

# 本地手动检测 + 可选自动发布
ENABLE_LLM_SUMMARY=true npm run sync:curated

# 天猫国际：定时 crawl 仅检测 rule.tmall.hk 变更后自动更新卡片；需强制重生效期卡时用下方命令或 Actions「Sync Intl Curated Cards」
ENABLE_LLM_SUMMARY=true npm run sync:curated:intl
```

可选环境变量：

- `ENABLE_CURATED_AUTO_PUBLISH`：默认 `true`；设为 `false` 时仅标记 `changed`，不覆盖卡片
- `NOTIFY_WEBHOOK_URL`：变更后 POST JSON（预留钉钉/企业微信等）
- `LLM_MAX_CURATED_SOURCES_PER_RUN`：单次 Actions 最多自动发布几条来源
- `LLM_MAX_INSIGHTS_PER_RUN`：单次 sync 最多为几条变更来源生成分类变更分析（默认 2）

```bash
# 首次写入体验分三栏（从已清理的 JSON 模板同步到 data/ 与 public/data/）
npm run migrate:score-insights
```

回滚展示：在 Git 历史中恢复 `data/curated-cards.json` 的上一版即可。

## 首页抓取源芯片（与真实爬虫对齐）

首页「后端抓取状态」下的三个来源芯片，与 [`src/config.js`](src/config.js) 中的 `CRAWL_SOURCE_MANIFEST` 及爬虫分项报告一致：

| 展示名 | 实际路径 |
|--------|----------|
| 天猫规则中心（MTOP） | rulechannel MTOP 列表/搜索/详情 API |
| 天猫规则频道（网页） | `https://rulechannel.tmall.com/` HTML 兜底 |
| 天猫规则中心（网页） | `https://rule.tmall.com/` HTML 兜底 |

当 MTOP 单次抓取 ≥20 条时，两条网页源标记为 `skipped`（未执行）；状态写入 `data/status.json` 的 `sources` 字段。与 `platforms.json` 的 `dataSources`（平台元数据）无关。

## 多平台（侧栏下拉 + platforms.json）

平台注册表：[`data/platforms.json`](data/platforms.json)（同步到 `public/data/platforms.json`）。侧栏 **监控平台** 下拉切换；`enabled: true` 的平台可正常使用。**抖音** 与 **天猫** 共用四类 Tab key（`shelf` / `score` / `ship` / `penalty`）及相同展示文案（商品效期要求、店铺真实体验分、发货时效、发货违规及处罚），数据分别存放在 `data/` 与 `data/douyin/`。

### 抖音分类页（与天猫对齐）

抖音与天猫使用**相同的四类 Tab key 与文案**，前端共用 `index.html` 的 `renderSection()` 布局；数据目录为 `data/douyin/curated-*.json`（与天猫根目录 `curated-*.json` 结构一致）。

| Tab key | 展示名称 | 抖音锚点示例 |
|---------|----------|--------------|
| `shelf` | 商品效期要求 | 《商品保质期管理和宣传规范》（[文章 aJk964FFQKKZ](https://school.jinritemai.com/doudian/web/article/aJk964FFQKKZ)） |
| `score` | 店铺真实体验分 | 《商家体验分规范》（slug `103956`） |
| `ship` | 发货时效 | 消极服务细则、揽收时效、物流轨迹 |
| `penalty` | 发货违规及处罚 | 5 条发货违规**实施细则**各 1 张卡（发货超时、缺货/无货、物流轨迹超时/异常、欺诈发货）；总纲 `101706` 仅出现在 `ship` |

详情拉取走 `fetchDouyinRuleDetailForCurated`；API 失败时可参考 `data/douyin/rule-text/rule-{slug}.txt` 手工兜底。

**维护流程：**

1. 在 `data/douyin/curated-sources.json` 为每类配置锚点规则（`id` + `slug` + `categories` + `cardIds`）
2. 手工或 LLM 整理 `curated-cards.json`（每类 3～4 张卡）
3. 首期可手工编写 `curated-category-insights.json`（如 `score` 的 `pinned: true` 变更解读块）
4. 重建种子数据：`npm run build:curated:douyin`
5. 重标规则分类标签：`npm run migrate:douyin:categories`（或重新 `crawl:douyin`）
6. 配置 `DEEPSEEK_API_KEY` 后跑 `npm run sync:curated:douyin`；重点来源可用 `npm run sync:curated:douyin:force`（日常变更检测与重写以 sync 为准，`sync-douyin-curated-watch-dates.mjs` 仅用于手工校正 watch 时间戳）
7. 镜像目录 `public/data/douyin/` 须与 `data/douyin/` 保持一致

### 数据目录约定

```text
data/
  platforms.json              # 平台清单（分类 Tab、周度过滤、数据来源文案）
  rules.json                  # 现阶段：全平台抓取池（可用 platformScope 标注）
  curated-*.json              # 天猫平台（历史路径，data 根目录）
  intl/curated-*.json         # 天猫国际
  {platformId}/               # 新平台，例如 douyin/、jd/
    curated-cards.json
    curated-sources.json
    curated-watch.json
    curated-category-insights.json
    rules.json                # 可选：平台独立周度池（二期）
```

- 本地记忆键：`rule-monitor-platform`（兼容旧键 `tmall-rule-platform`）
- 周度 API：`GET /api/weekly?platform=<weeklyScope>`（如 `tmall`、`intl`、`douyin`）
- 分类 sync 预留：`CURATED_DATA_PREFIX=intl/` 或 `PLATFORM_ID=intl` → 读写 `data/intl/curated-sources.json`（见 `scripts/sync-curated-cards.mjs` 顶部注释）；抖音使用 `--platform=douyin` 或 `PLATFORM_ID=douyin`

### 常用命令（天猫国际）

- 抓取（含通用 MTOP + **规则公示栏** 专用管道，公示详情单次最多 50 条）：`npm run crawl:intl`
- 探测公示栏 list API 参数：`npm run probe:intl:publicity`
- 分类页来源同步：`npm run sync:curated:intl`

公示栏默认按 `lastCategoryId=636`（`#/rules?cId=636`）分页拉列表；可通过环境变量 `INTL_PUBLICITY_CATEGORY_ID`、`INTL_PUBLICITY_DETAIL_LIMIT` 覆盖。`data/intl/status.json` 的 `sources` 会单独报告 `mtop-hk-publicity` 芯片。

### 常用命令（抖音）

- 抓取：`npm run crawl:douyin`（**规则动态**对齐栏目 [`/doudian/web/rules/11688`](https://school.jinritemai.com/doudian/web/rules/11688?tabKey=rules)，`rule/list?rule_type=0&direction=2` 默认 10 页；另含规则库目录与首页必读/推荐；周度统计仅公告类来源）
- 探测栏目 API：`node scripts/probe-douyin-section-11688.mjs`
- 重建分类页种子数据：`npm run build:curated:douyin`
- 重标规则分类标签：`npm run migrate:douyin:categories`
- 分类页来源同步：`npm run sync:curated:douyin`
- 强制重生成体验分锚点：`npm run sync:curated:douyin:force`（`dy-rule-101706` 仅 ship）
- 清理 penalty 重复卡（删总纲浅卡、去掉 body「来源/参见」）：`npm run clean:douyin:penalty`
- 强制重生成 5 条 penalty 实施细则：`ENABLE_LLM_SUMMARY=true npm run sync:curated:douyin:penalty:force`
- penalty 防回归检查：`npm run audit:douyin:penalty`（标题无冒号后缀、须含认定①、扣罚分行 ≥2 条 li）

## 常用命令
- 启动：`npm run start`
- 开发模式：`npm run dev`
- AI 补摘要：`npm run summarize`
- 分类页来源同步：`npm run sync:curated`
- 安装开机自启动（Windows）：`npm run autostart:install`
- 移除开机自启动（Windows）：`npm run autostart:remove`

## 可用接口
- `GET /api/health`
- `GET /api/status`
- `GET /api/rules`
- `POST /api/fetch`
- `POST /api/crawl`
- `GET /api/dashboard`
- `GET /api/conclusions`
- `GET /api/presentation`
- `GET /api/weekly?platform=<weeklyScope>`（如 `tmall`、`intl`；规划中平台无数据）
- `GET /data/platforms.json`
- `GET /data/status.json`
- `GET /data/scraped.json`
- `GET /data/timeline.json`

## 无法打开 localhost 排查
1. 检查 3000 端口是否被监听：
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

2. 如端口被旧进程占用，先结束旧进程再启动：
```powershell
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
npm run start
```

3. 验证服务是否正常：
```powershell
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
```

## 备注
- 目前页面展示以你给定模板为准。
- 若你后续再次要求“覆盖项目”，直接替换根目录 `index.html` 与 `data/*.json`，再同步到 `public/index.html` 即可。

## Render 长期稳定发布（推荐）
本项目已提供 `render.yaml`，可直接按 Blueprint 方式部署。

1. 将代码推送到 GitHub 仓库（私有/公开均可）
2. 打开 Render 控制台 -> `New` -> `Blueprint`
3. 选择该仓库，Render 会自动识别 `render.yaml`
4. 确认创建后等待构建完成
5. 打开 `https://<你的服务域名>/api/health`，返回 `ok: true` 即上线成功

发布配置说明（已内置）：
- 单实例运行（避免重复执行定时任务）
- 持久化磁盘挂载到 `/opt/render/project/src/data`
- 健康检查：`/api/health`
- 内置定时抓取：每天早上 `09:00`（`Asia/Shanghai`）

注意：
- 若需真正长期稳定在线，请使用非休眠套餐（如 Starter 及以上）。
- 首次上线后可手动调用 `POST /api/crawl` 触发一次立即抓取。
