import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUser } from '@/lib/auth-middleware'

const MAX_HISTORY = 10
const MAX_MEMORIES = 15
const MAX_DOC_CHARS = 24000

const SYSTEM = `You are Vincify AI, a precise personal productivity assistant.
Use only the context provided; never invent tasks, dates or numbers. Be concise and practical, use short markdown.
Do not use emoji. When the user shares a durable preference, routine, goal or fact about themselves,
append at the very end one line per item in the form <memory category="preference|fact|goal|routine">short statement</memory>.`

/** Send a chat message; persists both turns and returns the assistant reply. */
export const sendChat = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ conversationId: z.string().uuid().nullable(), content: z.string().trim().min(1).max(8000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, user } = context
    const { complete } = await import('@/lib/server/ai.server')
    let conversationId = data.conversationId
    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title: data.content.slice(0, 60) })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      conversationId = conv.id as string
    }
    const { error: insErr } = await supabase
      .from('messages')
      .insert({ user_id: user.id, conversation_id: conversationId, role: 'user', content: data.content })
    if (insErr) throw new Error(insErr.message)

    const nowIso = new Date().toISOString()
    const dayEnd = new Date(Date.now() + 36 * 3600 * 1000).toISOString()
    const [profile, prefs, tasks, events, memories, history] = await Promise.all([
      supabase.from('profiles').select('preferred_name,full_name,occupation,goals,timezone').eq('id', user.id).maybeSingle(),
      supabase.from('user_preferences').select('memory_enabled').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('tasks')
        .select('title,priority,status,due_at')
        .in('status', ['not_started', 'in_progress', 'postponed'])
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(8),
      supabase.from('calendar_events').select('title,starts_at').gte('starts_at', nowIso).lte('starts_at', dayEnd).order('starts_at').limit(6),
      supabase.from('ai_memories').select('content').eq('enabled', true).order('updated_at', { ascending: false }).limit(MAX_MEMORIES),
      supabase
        .from('messages')
        .select('role,content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORY),
    ])
    const p = profile.data
    const memoryOn = prefs.data?.memory_enabled !== false
    const ctx = [
      `Now: ${nowIso}. User timezone: ${p?.timezone ?? 'UTC'}.`,
      p && `User: ${p.preferred_name || p.full_name}${p.occupation ? `, ${p.occupation}` : ''}. Goals: ${(p.goals ?? []).join('; ') || 'none set'}.`,
      `Open tasks: ${(tasks.data ?? []).map((t) => `${t.title} [${t.priority}, ${t.status}${t.due_at ? `, due ${t.due_at}` : ''}]`).join(' | ') || 'none'}.`,
      `Upcoming events: ${(events.data ?? []).map((e) => `${e.title} at ${e.starts_at}`).join(' | ') || 'none'}.`,
      memoryOn && memories.data?.length ? `Known about user: ${memories.data.map((m) => m.content).join(' | ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const turns = (history.data ?? []).reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }))
    const raw = await complete([{ role: 'system', content: `${SYSTEM}\n\n${ctx}` }, ...turns], { sessionId: conversationId })

    const found = [...raw.matchAll(/<memory(?:\s+category="(\w+)")?>([\s\S]*?)<\/memory>/g)]
    const reply = raw.replace(/<memory[\s\S]*?<\/memory>/g, '').trim()
    const { data: msg, error: replyErr } = await supabase
      .from('messages')
      .insert({ user_id: user.id, conversation_id: conversationId, role: 'assistant', content: reply || 'I could not produce a reply.' })
      .select('*')
      .single()
    if (replyErr) throw new Error(replyErr.message)
    if (memoryOn && found.length) {
      const allowed = ['preference', 'fact', 'goal', 'routine']
      await supabase.from('ai_memories').insert(
        found.slice(0, 3).map((m) => ({
          user_id: user.id,
          content: m[2]!.trim().slice(0, 500),
          category: allowed.includes(m[1] ?? '') ? m[1] : 'preference',
          source_message_id: msg.id,
        })),
      )
    }
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
    return { conversationId, message: msg, memoriesSaved: memoryOn ? found.length : 0 }
  })

async function extractText(bytes: Uint8Array, mime: string, name: string): Promise<string> {
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    const { extractText: pdf, getDocumentProxy } = await import('unpdf')
    const doc = await getDocumentProxy(bytes)
    const { text } = await pdf(doc, { mergePages: true })
    return text
  }
  if (name.toLowerCase().endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return value
  }
  return new TextDecoder().decode(bytes)
}

/** Extracts a document and runs AI analysis. Timetable results wait for user review before anything is saved. */
export const analyzeDocument = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid(), kind: z.enum(['summary', 'timetable']) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, user } = context
    const { complete, parseJsonReply } = await import('@/lib/server/ai.server')
    const { data: doc, error } = await supabase.from('documents').select('*').eq('id', data.documentId).single()
    if (error || !doc) throw new Error('Document not found')
    const { data: job } = await supabase
      .from('document_processing')
      .insert({ user_id: user.id, document_id: doc.id, kind: data.kind })
      .select('id')
      .single()
    await supabase.from('documents').update({ status: 'processing' }).eq('id', doc.id)
    try {
      const file = await supabase.storage.from('documents').download(doc.storage_path)
      if (file.error) throw new Error(file.error.message)
      const text = (await extractText(new Uint8Array(await file.data.arrayBuffer()), doc.mime_type, doc.name)).slice(0, MAX_DOC_CHARS)
      if (text.trim().length < 20) throw new Error('No readable text was found in this document.')
      let result: unknown
      if (data.kind === 'summary') {
        const summary = await complete(
          [
            { role: 'system', content: 'Summarise the document in at most 8 markdown bullet points, then list action items if any. No emoji.' },
            { role: 'user', content: text },
          ],
          { sessionId: `doc-${doc.id}` },
        )
        result = { summary }
        await supabase.from('documents').update({ summary, status: 'ready' }).eq('id', doc.id)
      } else {
        const reply = await complete(
          [
            {
              role: 'system',
              content:
                'Extract the recurring weekly timetable from the text. Reply with JSON only: {"name": string, "entries": [{"title": string, "weekday": 0-6 (0=Sunday), "start_time": "HH:MM", "end_time": "HH:MM", "location": string|null}]}. Use only what the text states; if nothing is found return {"name":"Timetable","entries":[]}.',
            },
            { role: 'user', content: text },
          ],
          { sessionId: `doc-${doc.id}`, json: true },
        )
        const parsed = z
          .object({
            name: z.string().max(160).catch('Timetable'),
            entries: z
              .array(
                z.object({
                  title: z.string().min(1).max(200),
                  weekday: z.coerce.number().int().min(0).max(6),
                  start_time: z.string().regex(/^\d{1,2}:\d{2}/),
                  end_time: z.string().regex(/^\d{1,2}:\d{2}/),
                  location: z.string().max(200).nullable().optional(),
                }),
              )
              .max(200),
          })
          .parse(parseJsonReply(reply))
        result = parsed
        await supabase.from('documents').update({ status: 'ready' }).eq('id', doc.id)
      }
      await supabase.from('document_processing').update({ status: 'succeeded', result }).eq('id', job!.id)
      return { jobId: job!.id as string, result }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Processing failed'
      await supabase.from('document_processing').update({ status: 'failed', error: message }).eq('id', job!.id)
      await supabase.from('documents').update({ status: 'failed' }).eq('id', doc.id)
      throw new Error(message)
    }
  })

/** Sends the user's chosen digest to their own account email right now. */
export const sendDigestNow = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ ruleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, user } = context
    const { data: rule } = await supabase.from('automation_rules').select('*').eq('id', data.ruleId).single()
    if (!rule) throw new Error('Automation not found')
    const { runRule } = await import('@/lib/server/digest.server')
    return runRule(supabase, { id: user.id, email: user.email ?? '' }, rule)
  })

/** Permanently deletes the signed-in user's account and all owned data (cascades). */
export const deleteAccount = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ confirm: z.literal('DELETE') }).parse(d))
  .handler(async ({ context }) => {
    const { adminClient } = await import('@/lib/server/admin.server')
    const admin = adminClient()
    const { data: files } = await admin.storage.from('documents').list(context.user.id, { limit: 1000 })
    if (files?.length) await admin.storage.from('documents').remove(files.map((f) => `${context.user.id}/${f.name}`))
    const { error } = await admin.auth.admin.deleteUser(context.user.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
