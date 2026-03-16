# GitHub Pages (Free) + GitHub Actions Scheduled Crawl

This repo is set up to:

- Serve the site as static files via GitHub Pages.
- Run a daily crawler via GitHub Actions at 09:00 Asia/Shanghai (01:00 UTC).
- Update `data/status.json`, `data/scraped.json`, `data/timeline.json` automatically.

## 1. Push Code To GitHub

If `git push` works in your network:

```powershell
git push -u origin main
```

If `git push` cannot connect to GitHub (common in restricted networks):

1. Open your repo on GitHub in the browser.
2. `Add file` -> `Upload files`.
3. Upload the whole project (or at least these paths):
   - `.github/workflows/crawl.yml`
   - `scripts/gh-crawl.mjs`
   - `index.html`
   - `data/`
   - `.nojekyll`
4. Commit changes on GitHub.

## 2. Enable GitHub Pages

In GitHub repo:

1. `Settings` -> `Pages`
2. `Build and deployment`:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/(root)`
3. Save and wait for the Pages URL to appear.

## 3. Run Crawl Once Manually

1. Go to `Actions` tab.
2. Open workflow: `Crawl Tmall Rules`.
3. Click `Run workflow`.
4. After it finishes, check:
   - `data/status.json` updated in the repo.

## Notes

- GitHub Actions `schedule` uses UTC. The workflow is already set to `0 1 * * *` == 09:00 China time.
- The crawler may occasionally fail due to upstream anti-bot / network. In that case, the workflow will keep previous data and record an error status.

