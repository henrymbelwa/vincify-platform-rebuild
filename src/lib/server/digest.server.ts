import type { SupabaseClient } from '@supabase/supabase-js'
import { renderEmail, sendMail, mailConfigured } from '@/lib/server/mail.server'

export interface Rule {
  id: string
  user_id: string
  name: string
  trigger: 'daily_summary' | 'weekly_report' | 'overdue_tasks' | 'upcoming_events'
}

const fmt = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

/** Builds content from the user's real records. Returns null when there is nothing worth sending. */
async function build(db: SupabaseClient, userId: string, rule: Rule) {
  const { data: profile } = await db.from('profiles').select('preferred_name,full_name,timezone').eq('id', userId).maybeSingle()
  const tz = profile?.timezone || 'UTC'
  const name = profile?.preferred_name || profile?.full_name || 'there'
  const now = new Date()
  const appUrl = process.env['APP_URL'] || ''
  if (rule.trigger === 'overdue_tasks') {
    const { data } = await db
      .from('tasks')
      .select('title,due_at')
      .eq('user_id', userId)
      .in('status', ['not_started', 'in_progress', 'postponed'])
      .lt('due_at', now.toISOString())
      .order('due_at')
      .limit(20)
    if (!data?.length) return null
    return {
      subject: `${data.length} overdue task${data.length > 1 ? 's' : ''} need attention`,
      intro: `Hi ${name}, these tasks are past their due date.`,
      items: data.map((t) => `${t.title} (due ${fmt(t.due_at!, tz)})`),
      cta: { label: 'Open My Tasks', url: `${appUrl}/app/tasks` },
    }
  }
  if (rule.trigger === 'upcoming_events') {
    const { data } = await db
      .from('calendar_events')
      .select('title,starts_at,location')
      .eq('user_id', userId)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', new Date(now.getTime() + 86400000).toISOString())
      .order('starts_at')
    if (!data?.length) return null
    return {
      subject: `Your next 24 hours: ${data.length} event${data.length > 1 ? 's' : ''}`,
      intro: `Hi ${name}, here is what is scheduled.`,
      items: data.map((e) => `${fmt(e.starts_at, tz)} - ${e.title}${e.location ? `, ${e.location}` : ''}`),
      cta: { label: 'Open Calendar', url: `${appUrl}/app/calendar` },
    }
  }
  const days = rule.trigger === 'weekly_report' ? 7 : 1
  const since = new Date(now.getTime() - days * 86400000).toISOString()
  const [done, open] = await Promise.all([
    db.from('tasks').select('title').eq('user_id', userId).eq('status', 'completed').gte('completed_at', since).limit(50),
    db
      .from('tasks')
      .select('title,due_at,priority')
      .eq('user_id', userId)
      .in('status', ['not_started', 'in_progress'])
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(8),
  ])
  const completed = done.data ?? []
  const pending = open.data ?? []
  if (!completed.length && !pending.length) return null
  return {
    subject: rule.trigger === 'weekly_report' ? 'Your Vincify weekly report' : 'Your Vincify daily summary',
    intro: `Hi ${name}, you completed ${completed.length} task${completed.length === 1 ? '' : 's'} in the last ${days === 1 ? 'day' : '7 days'}. Next up:`,
    items: pending.map((t) => `${t.title}${t.due_at ? ` (due ${fmt(t.due_at, tz)})` : ''}`),
    cta: { label: 'Open Vincify', url: `${appUrl}/app` },
  }
}

/** Executes one rule for one user, records the run and an in-app notification. */
export async function runRule(db: SupabaseClient, user: { id: string; email: string }, rule: Rule) {
  let status: 'sent' | 'skipped' | 'failed' = 'skipped'
  let detail = 'Nothing to report from your records.'
  try {
    const content = await build(db, user.id, rule)
    if (content) {
      if (!mailConfigured()) throw new Error('Email delivery is not configured on the server.')
      if (!user.email) throw new Error('Your account has no email address.')
      await sendMail(
        user.email,
        content.subject,
        renderEmail(content.subject, content.intro, content.items, content.cta),
        [content.intro, ...content.items.map((i) => `- ${i}`)].join('\n'),
      )
      status = 'sent'
      detail = `Sent "${content.subject}" to ${user.email}`
    }
  } catch (e) {
    status = 'failed'
    detail = e instanceof Error ? e.message : 'Delivery failed'
  }
  await db.from('automation_runs').insert({ user_id: user.id, rule_id: rule.id, status, detail })
  await db.from('automation_rules').update({ last_run_at: new Date().toISOString() }).eq('id', rule.id)
  if (status !== 'skipped')
    await db.from('notifications').insert({
      user_id: user.id,
      category: 'automation',
      title: status === 'sent' ? `${rule.name} delivered` : `${rule.name} failed`,
      body: detail,
      link: '/app/automations',
    })
  return { status, detail }
}
