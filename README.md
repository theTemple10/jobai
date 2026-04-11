# JobAI — AI-Powered Job Application Platform

Upload your CV → AI parses it → Get matched jobs → Apply with one click.

## Features
- CV Parsing (PDF/image) via Claude AI
- 12+ AI-ranked job listings per profile
- One-click AI cover letter generation
- Auto Apply + Manual Apply modes
- Remote/Freelance mode for eligible professions
- Application tracker with toast notifications

## Tech Stack
React 18 + Vite · Tailwind CSS v3 · Anthropic Claude API

---

## Quick Start (Local)

Prerequisites: Node.js 18+, Anthropic API key (console.anthropic.com)

```bash
npm install
```

Create `.env.local`:
```
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

```bash
npm run dev
# Open http://localhost:5173
```

---

## Deploy to Vercel (Recommended — Free, ~2 minutes)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
# Create repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/jobai.git
git push -u origin main
```

### 2. Import on Vercel
1. Go to vercel.com → Sign in with GitHub (free)
2. Click "Add New Project"
3. Select your `jobai` repo → Click "Import"

### 3. Set Environment Variable
Before clicking Deploy, scroll to "Environment Variables":
- Name: `VITE_ANTHROPIC_API_KEY`
- Value: `sk-ant-your-key-here`
- Apply to: Production + Preview + Development

### 4. Click Deploy
Done. Live at `https://jobai-YOUR_USERNAME.vercel.app` in ~30 seconds.
Every future `git push` auto-redeploys.

---

## Deploy to Netlify (Alternative — Also Free)

### Option A: Drag & Drop (Fastest, no Git needed)
```bash
npm run build
```
Go to app.netlify.com → drag the `dist/` folder onto the dashboard.
Then: Site Settings → Environment Variables → add `VITE_ANTHROPIC_API_KEY`.
Trigger a redeploy to apply the key.

### Option B: Git-based (auto-deploy on push)
1. Connect GitHub repo in Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add `VITE_ANTHROPIC_API_KEY` under Site Settings → Environment Variables
5. Every push to `main` auto-deploys

---

## Custom Domain

Vercel: Project → Settings → Domains → add domain → update DNS at your registrar.
Netlify: Site Settings → Domain Management → Add custom domain.
Both auto-issue free SSL certificates.

---

## Getting Your Anthropic API Key

1. Visit console.anthropic.com
2. Go to API Keys → Create Key
3. Copy it (starts with sk-ant-...)
4. Paste into .env.local or your host's env variable UI

Cost: ~$0.01–$0.03 per CV parse + job match session using claude-sonnet-4.

---

## Security Note for Public Apps

The VITE_ prefix exposes the key in the client bundle — fine for personal use.
For a public app, add a backend proxy:
- Vercel: create `/api/claude.js` serverless function to hold the key server-side
- Add rate limiting to prevent abuse

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Blank page after deploy | Check env var starts with VITE_ |
| API key error | Verify .env.local exists with correct key |
| Build fails | Run npm install then npm run build |
| CV not parsing | File must be under 10MB, PDF or image |

---

## Customisation

- Add job boards: edit JOB_BOARDS array in App.jsx
- Change AI model: edit MODEL constant in App.jsx
- Persist data: swap useState for localStorage
- Add auth: wrap App with Clerk or Supabase Auth

MIT License
