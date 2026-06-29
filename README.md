# RainWatch Ghana

Live community rain/flood reporting app — anyone can submit a report (text + photo/video + location), everyone sees it appear in real time on the feed. Each report's location links straight to Google Maps so emergency responders can navigate there directly.

## 1. Set up Supabase (5 min)
1. Create a free project at supabase.com
2. Run `setup.sql` (included alongside this app) in the Supabase SQL Editor — creates the `reports` table, RLS policies, and the `report-media` storage bucket.
3. Go to Settings → API, copy your **Project URL** and **anon public key**.
4. Create a `.env` file (see `.env.example`) and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. In the SQL Editor, enable Realtime on the table: `alter publication supabase_realtime add table reports;`

## 2. Run locally
```bash
npm install
npm run dev
```
Opens at http://localhost:5173

## 3. Deploy (so the public can use it)
Easiest: push this folder to GitHub, then import it on vercel.com (free) — it auto-detects Vite and deploys in ~1 minute. Set the same env vars from `.env` in your Vercel project settings. Or run `npm run build` and drag the `dist` folder into netlify.com/drop.

## How it works
- Reports are stored in Supabase Postgres
- Photos/videos go to Supabase Storage
- The feed updates instantly for all open browsers via Supabase Realtime — no refresh needed
- No login required to submit a report (keeps friction low during emergencies)
- Each report with GPS coordinates shows a clickable location link that opens Google Maps at that exact point
- The feed can be filtered by severity, sorted by newest/oldest, and paginated (20/50/100 reports per page)
- Fully responsive layout (desktop, tablet, mobile)
- Footer with links to the developer's GitHub and LinkedIn

## Current limits
- The feed fetches the most recent 100 reports from the database; pagination works within that batch. If report volume grows past 100, older reports won't be reachable yet — switching to server-side pagination (Supabase `.range()`) would be the next step.
- No rate limiting or CAPTCHA on submissions — anyone can insert unlimited reports. Worth adding before high-traffic public launch.
- No file size/type limit on the storage upload policy — consider restricting before going live.

## Next steps (optional, once this is live)
- Add an admin view to mark reports verified/resolved
- Add SMS reporting via Twilio for low-data users
- Add rate limiting / CAPTCHA on report submission
- Switch to server-side pagination once report volume exceeds 100
