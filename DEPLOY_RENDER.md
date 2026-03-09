# Render Long-Term Deployment

This project includes a ready-to-use Render blueprint file:

- `render.yaml`

It deploys a single always-on web service with a persistent disk and uses the app's built-in scheduler.

## What is preconfigured

1. Single instance (avoids duplicated scheduled crawling).
2. Persistent disk mounted at `/opt/render/project/src/data`.
3. Health check endpoint: `/api/health`.
4. Timezone: `Asia/Shanghai`.
5. Built-in crawl scheduler: every day at `09:00` (China time).

## Deployment steps

1. Push this repository to GitHub.
2. In Render, click `New` -> `Blueprint`.
3. Connect your repository and create the service.
4. Wait for build and deploy to complete.
5. Verify:
   - Open `https://<your-render-domain>/api/health`
   - Expect JSON with `"ok": true`

## Important notes

1. Use an always-on plan (for example `Starter` or above), otherwise long-term stability is not guaranteed.
2. On first deploy, call `POST /api/crawl` once to initialize latest data.
3. If you ever want to use platform cron instead of in-app cron, set env var:
   - `ENABLE_INTERNAL_CRON=false`

