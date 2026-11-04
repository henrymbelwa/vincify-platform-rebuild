# Stage A: backend configuration audit (read only)

Nothing was changed, and no secret values were read or printed.

## 1. AI provider

**Where AI runs** (`src/lib/api.functions.ts`, using `src/lib/server/ai.server.ts`)
- `sendChat`: assistant chat. It saves to conversations and messages and uses ai_memories as context.
- `analyzeDocument`: document summaries and timetable extraction. Text comes out of PDFs through `unpdf` and out of DOCX files through `mammoth`. Results go to document_processing, timetables and timetable_entries.
- Both call `complete()`, which tries `AI_PROVIDER` first. When `AI_FALLBACK` is not `false`, it then tries the other provider, skipping any provider that isn't configured.

**Which provider the code expects**: Langflow by default. Set `AI_PROVIDER=openai` to use any OpenAI-compatible API instead (`POST {OPENAI_BASE_URL}/chat/completions`).

| Variable | Purpose | Required |
|---|---|---|
| AI_PROVIDER | `langflow` or `openai` | Yes (defaults to langflow) |
| AI_FALLBACK | `true`/`false`: try the other provider when the first fails | Optional |
| LANGFLOW_URL | Address of the Langflow server | If using Langflow |
| LANGFLOW_FLOW_ID | Which Langflow flow to run | If using Langflow |
| LANGFLOW_API_KEY | Sent as the `x-api-key` header | If your Langflow needs it |
| OPENAI_BASE_URL | Address of the OpenAI-compatible API | Optional (defaults to OpenAI) |
| OPENAI_API_KEY | API key, sent as a Bearer token | If using openai |
| OPENAI_MODEL | Model name | Optional (defaults to gpt-4o-mini) |

**Hugging Face Inference Providers**: yes, with no code rewrite. Their router speaks the OpenAI-compatible format:
- `AI_PROVIDER=openai`
- `OPENAI_BASE_URL=https://router.huggingface.co/v1`
- `OPENAI_API_KEY=<HF token with Inference Providers permission>`
- `OPENAI_MODEL=<model id, for example meta-llama/Llama-3.3-70B-Instruct>`

Caveat: document analysis asks for `response_format: json_object`. Some Hugging Face models don't support it and return an error (400). The reply is already read leniently, so the fix is small: drop that setting when a new flag is off. That flag doesn't exist yet and would need a small code change.

**Gaps found**
1. AI calls have no time limit or retry. A slow provider can hang until Vercel cuts the request off (60 s on Hobby, 300 s on Pro).
2. The provider's error message is hidden. Only the status code is shown, which makes it hard to tell a bad key from a wrong model.
3. There's no flag to turn off `json_object` mode, the Hugging Face caveat above.
4. Langflow replies are read from one fixed position in the response. Flows built differently will return an empty answer.

## 2. Email delivery

| Email | Sent by |
|---|---|
| Registration confirmation, password reset, Google sign-in links | Supabase Auth itself, not the app code |
| Daily, weekly and report digests from Automations, plus "Send now" | The app, over SMTP through nodemailer (`src/lib/server/mail.server.ts`) |
| Event reminders | In-app notifications only, no email |

The app uses SMTP, not an email API.

| Variable | Purpose |
|---|---|
| SMTP_HOST | SMTP server address |
| SMTP_PORT | 465 (default) or 587 |
| SMTP_SECURE | `true` for 465, `false` for 587 (STARTTLS) |
| SMTP_USER | Mailbox login |
| SMTP_PASS | Mailbox or app password |
| EMAIL_FROM | Sender, for example `Vincify <no-reply@yourdomain>`. Defaults to SMTP_USER |

**PlainSMTP or any other SMTP provider** works without code changes. Only the six variables above change.

**Recommendation**: for sign-up and password-reset emails, enter the same SMTP details in the Supabase dashboard under Authentication > Emails > SMTP Settings. Supabase's built-in sender is heavily rate-limited, so it isn't suitable for production.

## 3. Vercel scheduled jobs

- The handler at `src/routes/api/cron/automations.ts` only accepts GET requests that carry `Authorization: Bearer <CRON_SECRET>`. Anything else is refused (401). It uses the service-role key, runs due automations in each user's own time zone, and creates event reminders.
- `vercel.json` sets the build command to `NITRO_PRESET=vercel npm run build` and schedules a cron for `/api/cron/automations` every 15 minutes.
- When `CRON_SECRET` is set as an environment variable in Vercel, Vercel's cron automatically sends exactly that header. The job works as written.

**Compatibility issues**
1. **Plan limit**: Vercel Hobby runs cron jobs at most once a day. On Hobby, a 15-minute schedule fails at deploy time or runs only daily. That would break hourly digests and event reminders.
   - Option A: Vercel Pro.
   - Option B: change the schedule to daily on Hobby.
   - Option C: use an outside scheduler, such as cron-job.org or Supabase pg_cron with pg_net, to call the URL every 15 minutes with the Bearer header.
2. **Scale**: the job handles users one at a time in a single run. That's fine at small scale, but with many users it could exceed the time limit.

**Setup**: generate a long random `CRON_SECRET`, add it in Vercel Project Settings > Environment Variables for Production, then redeploy. You can check the job under Project > Cron Jobs.

## 4. Deployment readiness

**Full variable list for Vercel**

| Variable | Scope | Purpose |
|---|---|---|
| VITE_SUPABASE_URL | Public, needed at build | Browser Supabase address |
| VITE_SUPABASE_PUBLISHABLE_KEY | Public, needed at build | Browser key (publishable) |
| VITE_APP_URL | Public | Site URL |
| SUPABASE_URL | Server | Server Supabase address |
| SUPABASE_PUBLISHABLE_KEY | Server | Checks users in server functions |
| SUPABASE_SERVICE_ROLE_KEY | Server, secret | Cron job and account deletion only |
| APP_URL | Server | Links in emails, for example `https://vincify.vercel.app` |
| AI_* / LANGFLOW_* / OPENAI_* | Server | See section 1 |
| SMTP_* / EMAIL_FROM | Server | See section 2 |
| CRON_SECRET | Server, secret | See section 3 |
| NITRO_PRESET | Build | `vercel` (also set inside `vercel.json`) |

**Currently missing from this workspace's settings**: all of the AI, SMTP, `CRON_SECRET`, `APP_URL` and `VITE_APP_URL` values. Only the Supabase values are set.

**Could fail after deployment**
1. `sendChat` and `analyzeDocument`: they fail with "No AI provider is configured" until the AI variables are set. Large PDFs can also hit the time limit.
2. "Send now" and the cron digests: they fail until SMTP is configured.
3. Cron: the plan limit described in section 3.
4. Google sign-in: Supabase needs `https://<vercel-domain>/auth/callback` added under Auth > URL Configuration. The Site URL must be the Vercel domain, and Google OAuth must be enabled.
5. Build: `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which includes Nitro. It is set to honour `NITRO_PRESET=vercel`, but no Vercel build has been run to confirm this. Also, `nitro` is pinned to a beta version.
6. `VITE_*` values are baked in at build time. Set them before the first build.

## Proposed changes (only after your approval)
1. Add a time limit and clearer errors to AI calls, plus a flag to turn off JSON mode for Hugging Face.
2. Make reading Langflow replies more forgiving of different response shapes.
3. Choose a cron strategy (Pro, daily on Hobby, or outside scheduler), and update `vercel.json` and `.env.example` to match.
4. Write a short Vercel and Supabase setup checklist in the README covering redirect URLs, SMTP in Supabase Auth and the variable list.
