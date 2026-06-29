# RainWatch Ghana

Live community rain/flood reporting app — anyone can submit a report (text + photo/video + location), everyone sees it appear in real time on a feed and map.

## 1. Set up Supabase (5 min)
1. Create a free project at supabase.com
2. Run `setup.sql` (included alongside this app) in the Supabase SQL Editor — creates the `reports` table, RLS policies, and the `report-media` storage bucket.
3. Go to Settings → API, copy your **Project URL** and **anon public key**.
4. Open `src/supabaseClient.js` and paste them in.

## 2. Run locally
```bash
npm install
npm run dev
```
Opens at http://localhost:5173

## 3. Deploy (so the public can use it)
Easiest: push this folder to GitHub, then import it on vercel.com (free) — it auto-detects Vite and deploys in ~1 minute. Or run `npm run build` and drag the `dist` folder into netlify.com/drop.

## How it works
- Reports are stored in Supabase Postgres
- Photos/videos go to Supabase Storage
- The feed and map update instantly for all open browsers via Supabase Realtime — no refresh needed
- No login required to submit a report (keeps friction low during emergencies)

## Next steps (optional, once this is live)
- Add an admin view to mark reports verified/resolved
- Add SMS reporting via Twilio for low-data users
- Add area/date filters once report volume grows
