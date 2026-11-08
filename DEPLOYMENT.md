# Vincify Platform Rebuild — Production Deployment Guide

This guide details the procedure for connecting and deploying Vincify to Vercel with your Supabase backend, AI engine, and scheduled automations.

---

## 1. Connecting GitHub Repository to Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** &rarr; **Project**.
3. Select your connected GitHub repository (`vincify-platform-rebuild` or your repository fork).
4. **Framework Preset**: Select **Other** (TanStack Start with Nitro preset).
5. **Build Command**: `NITRO_PRESET=vercel npm run build` (pre-configured in `vercel.json`).
6. **Output Directory**: `.output` (handled automatically by Nitro).

---

## 2. Environment Variables Configuration

In your Vercel Project Settings &rarr; **Environment Variables**, add the following environment variables:

### A. Public Client Variables (Browser-accessible)
| Variable Name | Description | Example / Required Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon / Publishable key | `eyJhbGciOi...` |
| `VITE_APP_URL` | Production application URL | `https://your-domain.vercel.app` |

### B. Server-Only Secret Variables (Never exposed to browser)
| Variable Name | Description | Example / Required Value |
|---|---|---|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Same as `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (used for server-side RPC, auth admin, cron) | `eyJhbGciOi...` |
| `APP_URL` | Server URL | `https://your-domain.vercel.app` |
| `NITRO_PRESET` | Nitro Vercel serverless preset | `vercel` |

### C. AI Engine & Provider Secrets
| Variable Name | Description | Example / Required Value |
|---|---|---|
| `GEMINI_API_KEY` | Primary Google Gemini API key | `AIzaSy...` |
| `GEMINI_MODEL` | Default Gemini model | `gemini-3.5-flash-lite` |
| `GEMINI_TIMEOUT_MS` | AI timeout budget in ms | `45000` |
| `DOCUMENT_ANALYSIS_DAILY_LIMIT` | Atomic daily quota limit per user | `3` |
| `AI_ENCRYPTION_SECRET` | 32-character encryption secret for AES-256-GCM vault | `a-32-char-random-secret-key...` |
| `INITIAL_ADMIN_EMAIL` | Bootstrap administrator email | `adminvincify@gmail.com` |

*(Optional additional provider keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CUSTOM_AI_BASE_URL`)*

### D. Transactional Email (SMTP)
| Variable Name | Description | Example / Required Value |
|---|---|---|
| `SMTP_HOST` | Mail server host | `smtp.gmail.com` or `smtp.example.com` |
| `SMTP_PORT` | SMTP port | `465` (or `587`) |
| `SMTP_SECURE` | Use SSL/TLS | `true` |
| `SMTP_USER` | SMTP username / mailbox email | `you@domain.com` |
| `SMTP_PASS` | SMTP password or App Password | `app-password-token` |
| `EMAIL_FROM` | Sender display string | `"Vincify <you@domain.com>"` |

### E. Cron & Background Scheduler
| Variable Name | Description | Example / Required Value |
|---|---|---|
| `CRON_SECRET` | Bearer token protecting `/api/cron/automations` | `long-random-secret-string` |

---

## 3. Supabase Migrations Execution

Apply both migration files to your Supabase project in the **SQL Editor** in order:

1. `supabase/migrations/20261104000000_init.sql` (Base database tables, RLS policies, triggers, and documents storage bucket)
2. `supabase/migrations/20261105224331_9f7d9248-1f6d-4fbe-b346-873e75c217b5.sql` (Daily document analysis atomic usage tracking)
3. `supabase/migrations/20261108000000_habits_admin_ai_usage.sql` (Habits & streaks, time-blocking task links, admin roles, AI control centre vault, usage telemetry, audit logs)

---

## 4. Supabase Auth & Redirect URLs

In your Supabase Dashboard &rarr; **Authentication** &rarr; **URL Configuration**:
- **Site URL**: `https://your-domain.vercel.app`
- **Redirect URLs**:
  - `https://your-domain.vercel.app/**`
  - `https://your-domain.vercel.app/auth/callback`
  - `https://your-domain.vercel.app/reset-password`

---

## 5. Administrator Portal Provisioning

1. Register an account with `adminvincify@gmail.com` through the normal Vincify registration page (`/auth`).
2. Log in. Because `INITIAL_ADMIN_EMAIL=adminvincify@gmail.com` is configured, your account is automatically bootstrapped into `public.admin_users` as `superadmin`.
3. Navigate to `/admin` to access the Vincify Administrator Portal and AI Control Centre.
