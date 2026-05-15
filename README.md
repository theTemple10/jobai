# JobAI — AI-Powered Job Application Platform

> Upload your CV → AI parses it → Get matched jobs → Apply in one click.

Live demo: **[jobai-orpin.vercel.app](https://jobai-orpin.vercel.app)**

---

## Features

- **CV Parsing** — Upload a PDF or image; AI extracts your skills, experience, and role
- **Job Matching** — 12+ real, ranked job listings pulled from JSearch (RapidAPI)
- **AI Cover Letters** — One-click generation tailored to each job posting
- **Apply Flow** — Opens the job page and copies your cover letter to clipboard
- **Remote / Freelance Mode** — Toggle for eligible professions
- **Application Tracker** — Track applied jobs with live toast notifications
- **Email Notifications** — Get a copy of your cover letter via EmailJS

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS v3 |
| AI (text) | Groq API — `llama-3.3-70b-versatile` |
| AI (vision / CV parsing) | Groq API — `llama-4-scout` |
| Job listings | JSearch via RapidAPI |
| Email | EmailJS |
| PDF parsing | PDF.js (CDN, dynamically loaded) |
| Backend proxy | Vercel serverless functions (`/api/`) |
| Deployment | Vercel |

---

## Architecture: Secure Backend Proxy

API keys are **never exposed in the browser bundle**. All external API calls go through Vercel serverless functions:

```
Browser → /api/groq.js   → Groq API     (AI text + vision)
Browser → /api/jobs.js   → JSearch API  (job listings)
```

The `api/` folder lives at the project root and is automatically deployed as serverless functions by Vercel.

---

## Quick Start (Local)

**Prerequisites:** Node.js 18+, Groq API key (console.groq.com — free, no card required), JSearch key (rapidapi.com)

```bash
npm install
```

Create `.env.local`:
```
GROQ_API_KEY=your-groq-key-here
JSEARCH_KEY=your-jsearch-key-here
EMAILJS_SERVICE_ID=your-service-id
EMAILJS_TEMPLATE_ID=your-template-id
EMAILJS_PUBLIC_KEY=your-public-key
```

> ⚠️ Note: `GROQ_API_KEY` and `JSEARCH_KEY` have **no** `VITE_` prefix — they are server-side only and never sent to the browser.

```bash
npm run dev
# Open http://localhost:5173
```

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "your message"
git push origin main
```

### 2. Import on Vercel

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **Add New Project** → select your `jobai` repo → **Import**

### 3. Set Environment Variables

Before clicking Deploy, scroll to **Environment Variables** and add:

| Name | Value | Notes |
|---|---|---|
| `GROQ_API_KEY` | `your-groq-key` | No `VITE_` prefix — server-side |
| `JSEARCH_KEY` | `your-jsearch-key` | No `VITE_` prefix — server-side |
| `EMAILJS_SERVICE_ID` | `your-service-id` | Client-safe, add `VITE_` if accessing in frontend |
| `EMAILJS_TEMPLATE_ID` | `your-template-id` | Same as above |
| `EMAILJS_PUBLIC_KEY` | `your-public-key` | Same as above |

Apply each to: **Production + Preview + Development**.

### 4. Deploy

Click **Deploy**. Live in ~30 seconds. Every future `git push` auto-redeploys.

---

## Getting Your API Keys

### Groq (AI — Free, No Card Required)
1. Visit [console.groq.com](https://console.groq.com)
2. Sign up → API Keys → Create Key
3. Works globally, including Nigeria ✓

### JSearch (Job Listings)
1. Visit [rapidapi.com/letscrape-6bfat3ri3r](https://rapidapi.com/letscrape-6bfat3ri3r/api/jsearch)
2. Subscribe to the free tier
3. Copy your RapidAPI key

### EmailJS (Email Notifications)
1. Visit [emailjs.com](https://emailjs.com)
2. Create a service and email template
3. Copy your Service ID, Template ID, and Public Key

---

## Cost

| Service | Cost |
|---|---|
| Groq API | **Free** (generous rate limits, no card) |
| JSearch | **Free** tier available (10 req/month on basic) |
| EmailJS | **Free** tier (200 emails/month) |
| Vercel | **Free** (Hobby plan) |

Running this app costs **$0** on the free tiers.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Jobs not loading | Verify `JSEARCH_KEY` is set in Vercel without `VITE_` prefix |
| AI not responding | Check `GROQ_API_KEY` is set correctly (server-side) |
| Blank page after deploy | Check browser console for errors |
| CV not parsing | File must be under 10MB, PDF or image format |
| Email not sending | Confirm all three EmailJS variables are set |
| `api/` routes returning 404 locally | Use `vercel dev` instead of `npm run dev` for local proxy testing |

---

## Customisation

- **Add job boards** — edit the `JOB_BOARDS` array in `App.jsx`
- **Swap AI model** — edit the `MODEL` constant in `App.jsx` (see [Groq model list](https://console.groq.com/docs/models))
- **Persist data** — replace `useState` with `localStorage` or a database
- **Add user accounts** — wrap `App` with Clerk or Supabase Auth

---

## Project Structure

```
jobai/
├── api/
│   ├── groq.js          # Serverless proxy → Groq API
│   └── jobs.js          # Serverless proxy → JSearch API
├── src/
│   └── App.jsx          # Main React app
├── public/
├── .env.local           # Local secrets (never committed)
├── vercel.json          # Vercel config (if needed)
└── package.json
```

---

MIT License
