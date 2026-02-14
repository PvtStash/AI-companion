# Companion App Starter v2 (Automated Deploys)

This is a **starter monorepo** for a companion-style chat app with automation baked in.

## What you get
- **Mobile**: Expo (React Native) client
- **Backend**: Node.js + Express + Postgres + Prisma
- **AI**: OpenAI Responses API (server-side only)
- **Memory**: Structured memories + periodic recaps
- **Automation**:
  - Render **Blueprint** (`render.yaml`) to spin up backend + Postgres
  - GitHub Actions:
    - CI on PRs
    - **EAS Build** on merges
    - **Weekly Recap Cron** (scheduled) that hits a protected job endpoint

> Designed to be safe-by-default: no API keys in the app, PG-13 flirt allowed, adult explicit OFF.

## Repo structure
```
mobile/               Expo app
server/               Express API + Prisma
docs/                 PRD + safety notes
.github/workflows/     CI + mobile builds + cron jobs
render.yaml            Render Blueprint (backend + Postgres)
```

---

## The only human-fingers-required setup
You do these **once**:

1) **Create a GitHub repo** and upload this code.
2) **Create a Render account** and deploy from the Blueprint:
   - In Render: **New +** → **Blueprint** → connect your GitHub repo
   - Render will create:
     - a **PostgreSQL** database
     - a **web service** for `server/`
3) In Render, set environment variables on the web service:
   - `OPENAI_API_KEY` = your OpenAI key
   - `JOB_TOKEN` = a random long string (used to protect job endpoints)
   - (Render sets `DATABASE_URL` automatically from the linked DB)
4) **Create an Expo account** and generate an **EXPO_TOKEN** (for GitHub Actions).
   - Add it in GitHub → Settings → Secrets and variables → Actions:
     - `EXPO_TOKEN`
5) In GitHub, also add:
   - `JOB_TOKEN` (same value you set in Render)
   - `RENDER_SERVICE_URL` (your backend URL, e.g. https://your-app.onrender.com)

After that:
- Merge to `main` → CI runs + **mobile builds** can run via EAS
- Weekly recap job runs automatically via GitHub Actions schedule

---

## Local dev (optional)
### Backend
1. `cp server/.env.example server/.env`
2. Fill `DATABASE_URL` and `OPENAI_API_KEY`
3. `cd server && npm i`
4. `npx prisma migrate dev --name init`
5. `npm run dev` → http://localhost:8080/health

### Mobile
1. `cp mobile/.env.example mobile/.env`
2. Set `EXPO_PUBLIC_API_BASE=http://localhost:8080`
3. `cd mobile && npm i`
4. `expo start`

---

## Notes
- Adult/explicit mode is **not implemented** (requires age verification and compliance).
- The weekly recap job is protected by `JOB_TOKEN`.
