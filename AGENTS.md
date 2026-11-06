<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Backend is the user's own Supabase project via `@supabase/supabase-js` (`src/lib/supabase.ts`), configured only through env vars; no Lovable Cloud or Lovable runtime packages, so the app stays portable to Vercel.
- Schema lives in `supabase/migrations/*.sql`; every private table has `user_id` + owner-only RLS, child rows are checked by `assert_same_owner` triggers. Add new tables to the RLS loop in a new migration.
- Browser reads/writes go straight to Supabase under RLS; server functions (`src/lib/api.functions.ts`) are only for AI, document parsing, email and account deletion, authenticated by `requireUser` (bearer attached by `attachBearer` in `src/start.ts`).
- Service-role client (`src/lib/server/admin.server.ts`) is used only by the cron route and account deletion.
- AI goes through `src/lib/server/ai.server.ts` (native Gemini REST, key server-only; document analysis capped per user per day via the atomic `reserve_document_analysis` RPC); keep prompts compact (capped history and memories) to save tokens.
- Email uses SMTP via nodemailer (`src/lib/server/mail.server.ts`); scheduled sends run from `/api/cron/automations` protected by `CRON_SECRET`.
- Metrics must come from real records via `src/lib/metrics.ts`; cancelled tasks never count as completed; keep its tests passing.
- PWA: `vite-plugin-pwa` generateSW, registered only from `src/lib/pwa.ts` with preview/iframe guards.
- Every new env var must be added to `.env.example`. No emoji anywhere in UI or copy. Theme tokens live in `src/styles.css` (light and dark only).
