# Vincify — Production Build Plan

## What I learned from your materials
- Spec: Vincify 2050, an AI personal productivity "operating system" (29 sections: auth, onboarding, dashboard, AI assistant, planning, tasks, projects, documents, timetable, calendar, reports, automations, rewards, notifications, memory, settings).
- Previous build: TanStack Start app with Inter font, pink-to-purple brand gradient, collapsible sidebar shell, dashboard cards, tasks (list/board/timeline), check-in, assistant UI, onboarding tour, splash and logo. All data was fixtures; no backend.

## Non-negotiable rules applied
- Keep the previous UI and theme exactly (colors, gradient, Inter, radius, sidebar layout). Reuse its components, routes and shadcn UI files.
- Remove all fixtures and demo data; every screen reads and writes real data, with honest empty states.
- No emoji anywhere.
- Hostable on Vercel; no Lovable runtime dependencies. A complete `.env.example` documents every variable.
- PWA from day one (installable + offline app shell, guarded so it never runs in preview).
- Multi-user with strict per-user data isolation; multi-theme; fully responsive.

## Stack decisions (from your answers)
- Backend: your own Supabase project (auth, Postgres, private storage). You connect it in Settings; keys go in `.env`.
- AI: switchable provider via `.env` — Langflow primary, OpenAI-compatible fallback. All AI calls run server-side.
- Automations: engine built now, email channel only (WhatsApp later).
- Delivery: one full plan, built in ordered stages below.

## Build stages
1. Foundation: port theme, brand assets, shell, UI kit; Vercel adapter; `.env.example`; PWA manifest, icons, guarded service worker; theme switcher (Light, Dark, System, plus brand accent variants).
2. Auth and onboarding: email/password sign up with verification, sign in, password reset page, protected app area, onboarding profile form (role, goals, timezone, working hours), splash and first-visit flow.
3. Database: migrations for all 35 entities in the spec, foreign keys, indexes, timestamps, RLS on every private table, private storage buckets with owner policies.
4. Core productivity: dashboard (live widgets), tasks (list/board/timeline, filters, statuses incl. postponed/cancelled), goals, daily check-in, weekly and monthly plans, end-of-day review.
5. Vincify AI: conversations and messages persisted, streaming replies, context from user tasks/plans, controlled memory (user can view, edit, delete memories), attachments.
6. Projects workspace: objectives, milestones, project tasks, notes, custom tables (columns/rows), resources.
7. Documents and timetable intelligence: upload to private storage, AI extraction, review-and-confirm flow that creates timetable entries and calendar events.
8. Calendar: month/week/day views over events, tasks and timetable entries.
9. Reports and analytics: metrics from real records only (formulas per spec section 23), timezone-correct, charts, CSV and PDF export, "not enough data yet" states.
10. Notifications and automations: in-app notifications, preferences, rule builder (trigger, condition, action), scheduled runner via Vercel Cron, email delivery, execution history.
11. Referrals and rewards: unique codes, qualification on verified activity, anti-abuse checks, reward ledger.
12. Profile and settings: profile, preferences, theme, notification settings, data export, account deletion.
13. Hardening: input validation everywhere, rate limiting on AI and email, error boundaries, accessibility pass, tests for metric formulas, referral qualification and access rules.

## Technical details
- TanStack Start with server functions; Vercel deployment target (Nitro/Vercel preset) instead of Netlify/Cloudflare.
- Supabase clients: browser (publishable key), server per-request with user token (RLS), service role only in cron/automation handlers.
- `.env.example`: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, VITE_ variants, APP_URL, AI_PROVIDER, LANGFLOW_URL, LANGFLOW_FLOW_ID, LANGFLOW_API_KEY, OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL, EMAIL provider keys, EMAIL_FROM, CRON_SECRET.
- Token-efficient AI: compact context summaries, capped history window, memory retrieval by relevance instead of full dumps.
- Data fetching via TanStack Query loaders; code-split routes.

## Open items I need from you
1. Email sending provider for automations and notices: Resend, or plain SMTP (works with any mailbox)?
2. Themes: is Light, Dark, System plus a few brand accent palettes what you mean by "multi theme", or do you want specific named themes?
3. Sign-in methods: email/password only, or also Google?
4. Is "multi users" individual accounts only, or do you also need shared workspaces/teams?

Once you approve and answer these, I will connect-check your Supabase project and start Stage 1.
