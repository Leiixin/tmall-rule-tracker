# 天猫规则监控中心（本地运行版）

## 项目说明
本项目是一个本地可运行的网站，核心页面来自根目录的 `index.html`，运行后由 Node 服务托管到：

`http://localhost:3000`

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

## 常用命令
- 启动：`npm run start`
- 开发模式：`npm run dev`
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
