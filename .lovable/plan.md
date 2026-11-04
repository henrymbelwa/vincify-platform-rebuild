# Vincify read-only audit report

Nothing was changed. Checks covered the code and read-only queries on the connected Supabase project (ref rchpocunkrehnzwqmett).

## 1. Supabase client
- Done. `src/lib/supabase.ts` builds the browser client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, both set in `.env` for the connected project. It uses PKCE, saves the session and refreshes it automatically.
- Server functions get the user's bearer token through `attachBearer` in `src/start.ts` and re-check it in `requireUser`.
- Note: a second, unused set of generated files (`src/integrations/supabase/*`) also exists. No app screen imports it. It is harmless but duplicated.

## 2. Authentication
- Done: email/password registration (`signUp`), sign-in, Google sign-in (`signInWithOAuth` plus `/auth/callback`), password reset (`/reset-password`), sign-out from the sidebar and from settings, saved sessions with an `onAuthStateChange` listener (`src/lib/auth.tsx`), and onboarding.
- Not checked: whether Google is turned on in Supabase and whether the redirect URLs are set. That is dashboard configuration and can't be seen from the code.

## 3. Dashboard and data
- Every screen reads and writes real records through Supabase, and Row Level Security limits each user to their own rows. No mock, fixture or demo data was found. Empty states show when there are no records.

## 4. Feature-to-table wiring

| Feature | Tables | Status |
|---|---|---|
| Tasks | tasks | Connected (create, update, delete, list) |
| Goals | goals | Connected (check-in Goals tab, dashboard) |
| Habits | habits, habit_logs | MISSING: no screen and no code use them |
| Projects | projects, project_milestones, project_notes, project_objectives, project_resources, custom_tables/columns/rows | Connected |
| Documents | documents, document_processing | Connected (upload, AI analysis, download, delete) |
| Timetables | timetables, timetable_entries | Connected (built from documents, shown on calendar) |
| Calendar events | calendar_events | Connected, with reminders sent by the scheduled job |
| Check-ins | daily_checkins, weekly_plans, monthly_plans | Connected |
| Reports | reports | PARTIAL: the page calculates charts live from tasks and check-ins. Nothing is saved to the reports table, and there's no AI-written summary |
| AI conversations | conversations, messages, ai_memories | Connected through the `sendChat` server function |
| Notifications | notifications, notification_preferences | Connected (inbox, preferences, created by the scheduled job) |
| Automations | automation_rules, automation_runs | Connected |
| Rewards/referrals | referral_codes, referrals, reward_transactions | Connected (claimed during onboarding) |

Tables with no code using them: `habits`, `habit_logs`, `reports`, `planned_activities` (time blocks in the daily plan), `productivity_metrics` (saved daily scores), `reminders` (standalone reminders), `connected_integrations`.

## 5. Document storage
- Done. Uploads go to the private `documents` bucket at `<user_id>/<uuid>-<filename>`. Files are limited to PDF, DOCX and TXT up to 20 MB. If saving the record fails, the uploaded file is removed again. Downloads use 60-second signed links.
- The bucket has four storage rules (read, insert, update, delete), all named `vincify_document_*`. I didn't print what each rule contains. Confirming they match the user-folder rule is the first step of any follow-up.

## 6. Missing or incomplete backend features
1. Habits: there's no screen and no tracking logic.
2. Saved reports: there's no storage, history or AI summary for weekly or monthly reports.
3. Daily time-blocking (planned_activities): not wired.
4. Saved productivity metrics: scores are only calculated live.
5. Standalone reminders: the table exists, but nothing schedules or sends them. Event reminders work.
6. Connected integrations (email or WhatsApp verification): not wired. WhatsApp was deferred.
7. The Google sign-in, SMTP and AI provider (Langflow or OpenAI-compatible) settings aren't in `.env` yet. AI chat, document analysis and email will fail at runtime until they're added.
8. The scheduled job (`/api/cron/automations`) needs a scheduler such as Vercel Cron that sends `CRON_SECRET`. `vercel.json` should be checked.

## 7. Secret exposure
- None found. The service-role key is read only in server files (`src/lib/server/admin.server.ts` and `client.server.ts`) and is never included in browser code. The only `sb_secret_` mention is a prefix check. `.env` contains only the URL, the publishable key and the project ID.

## 8. 36 vs 37 tables
- The database has 37 public tables, all with Row Level Security on and no views. That is the same count as the schema list. The earlier figure of 36 most likely left out one table, probably `document_processing` or one of the child tables, or was counted before the last migration. The query result itself is exact: 37 tables, none without security rules.

## Proposed next step (after your approval)
Choose which missing items to build: habits, saved reports, time-blocking, metrics snapshots, standalone reminders. Then check the storage rule contents and the cron setup. No changes will happen until you approve.
