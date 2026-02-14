# One-Time Setup (Render + Postgres + EAS)

## 1) GitHub
- Create a new repo
- Upload this code
- Ensure default branch is `main`

## 2) Render (backend + DB)
1. In Render: **New +** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and creates:
   - `companion-db` (PostgreSQL)
   - `companion-server` (web service)

### Set env vars on `companion-server`
- `OPENAI_API_KEY` = your OpenAI API key
- `JOB_TOKEN` = a long random string (keep it secret)

Render injects `DATABASE_URL` automatically.

## 3) GitHub secrets
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `EXPO_TOKEN` = from Expo (EAS)
- `JOB_TOKEN` = same value you set in Render
- `RENDER_SERVICE_URL` = your Render service base URL (e.g. https://companion-server.onrender.com)

## 4) Expo / EAS
- Create Expo account
- Generate token:
  - https://expo.dev/accounts/<yourname>/settings/access-tokens
- Add it as `EXPO_TOKEN` in GitHub Secrets

## 5) First mobile build
- Make a small commit to `mobile/` and push to `main`
- GitHub Actions will run `Mobile EAS Build` and produce installable builds.

## 6) Weekly recaps
- The GitHub Action cron calls `/api/jobs/weekly-recap-all` once a week.
- You can trigger manually from GitHub Actions → Weekly Recap Cron → Run workflow.
