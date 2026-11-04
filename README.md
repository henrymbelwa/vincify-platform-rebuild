# Vincify

AI-powered personal productivity workspace: tasks, daily, weekly and monthly planning, goals, projects, documents with timetable extraction, calendar, reports, email automations, referrals and an AI assistant. Installable as an app (PWA), light and dark themes.

## Setup

1. Create a Supabase project.
2. Apply the schema: open the SQL editor and run `supabase/migrations/20261104000000_init.sql` (or `supabase db push`).
3. Auth settings in Supabase:
   - Authentication > URL configuration: Site URL = your app URL; add `https://YOUR-DOMAIN/auth/callback` and `https://YOUR-DOMAIN/reset-password` to Redirect URLs.
   - Authentication > Providers > Google: enable and paste your Google OAuth client ID and secret. In Google Cloud, the authorised redirect URI is `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
   - Email confirmations should stay on so referrals only qualify for verified accounts.
4. Copy `.env.example` to `.env` and fill in every value.
5. `npm install` then `npm run dev`.

## Deploy on Vercel

1. Import the repository in Vercel.
2. Add every variable from `.env.example` in Project Settings > Environment Variables (`NITRO_PRESET=vercel`).
3. Deploy. `vercel.json` sets the build and registers the automation runner on `/api/cron/automations`. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
   - The schedule (every 15 minutes) needs a Vercel Pro plan. On Hobby, Vercel only allows daily jobs, so instead call `GET /api/cron/automations` every 15 minutes from any external scheduler (for example cron-job.org) with the header `Authorization: Bearer YOUR_CRON_SECRET`.

## AI providers

`AI_PROVIDER=langflow` uses your Langflow flow (`/api/v1/run/{flow_id}`), `AI_PROVIDER=openai` uses any OpenAI-compatible API. With `AI_FALLBACK=true` the other provider is tried when the primary fails.

## Email

Automations send through plain SMTP (`SMTP_*`), so any mailbox works: Gmail (app password), Outlook, Zoho, cPanel and others.

## Tests

`npm test`
