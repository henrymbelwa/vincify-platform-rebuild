import { createFileRoute } from '@tanstack/react-router'

/**
 * Scheduled runner (Vercel Cron or any scheduler). Requires `Authorization: Bearer $CRON_SECRET`.
 * Runs due automation rules in each user's local hour and creates event reminders.
 */
export const Route = createFileRoute('/api/cron/automations')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env['CRON_SECRET']
        if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
          return new Response('Unauthorized', { status: 401 })
        }
        const { adminClient } = await import('@/lib/server/admin.server')
        const { runRule } = await import('@/lib/server/digest.server')
        const db = adminClient()
        const now = new Date()

        const { data: rules } = await db.from('automation_rules').select('*').eq('enabled', true).limit(2000)
        const userIds = [...new Set((rules ?? []).map((r) => r.user_id as string))]
        const { data: profiles } = userIds.length
          ? await db.from('profiles').select('id,timezone').in('id', userIds)
          : { data: [] as { id: string; timezone: string }[] }
        const tzOf = new Map((profiles ?? []).map((p) => [p.id, p.timezone || 'UTC']))
        let ran = 0
        for (const rule of rules ?? []) {
          const tz = tzOf.get(rule.user_id) ?? 'UTC'
          const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(now)
          const hour = Number(parts.find((p) => p.type === 'hour')?.value)
          const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '')
          if (hour < rule.send_hour) continue
          if (rule.trigger === 'weekly_report' && rule.weekday != null && wd !== rule.weekday) continue
          const minGap = rule.trigger === 'weekly_report' ? 6 * 86400000 : 20 * 3600000
          if (rule.last_run_at && now.getTime() - new Date(rule.last_run_at).getTime() < minGap) continue
          const { data: u } = await db.auth.admin.getUserById(rule.user_id)
          await runRule(db, { id: rule.user_id, email: u.user?.email ?? '' }, rule)
          ran++
        }

        // Event reminders -> in-app notifications.
        const horizon = new Date(now.getTime() + 7 * 86400000).toISOString()
        const { data: events } = await db
          .from('calendar_events')
          .select('id,user_id,title,starts_at,remind_minutes')
          .not('remind_minutes', 'is', null)
          .is('reminded_at', null)
          .gte('starts_at', now.toISOString())
          .lte('starts_at', horizon)
          .limit(2000)
        let reminded = 0
        for (const e of events ?? []) {
          if (new Date(e.starts_at).getTime() - e.remind_minutes * 60000 > now.getTime()) continue
          await db.from('notifications').insert({
            user_id: e.user_id,
            category: 'event',
            title: `Upcoming: ${e.title}`,
            body: `Starts at ${new Date(e.starts_at).toISOString()}`,
            link: '/app/calendar',
          })
          await db.from('calendar_events').update({ reminded_at: now.toISOString() }).eq('id', e.id)
          reminded++
        }
        return Response.json({ ran, reminded })
      },
    },
  },
})
