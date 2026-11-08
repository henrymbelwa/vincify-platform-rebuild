import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { ArrowUp, Bot, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/app/markdown'
import { LogoMark } from '@/components/brand/logo'
import { sendChat } from '@/lib/api.functions'
import { must, sb } from '@/lib/supabase'
import type { Message } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/assistant')({
  head: () => ({ meta: [{ title: 'Vincify AI' }] }),
  component: Assistant,
})

const STARTERS = ['Plan my day based on my tasks', 'What is overdue and what should I do first?', 'Help me break down my biggest project', 'Review my week']

function Assistant() {
  const qc = useQueryClient()
  const send = useServerFn(sendChat)
  const [active, setActive] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const convs = useQuery({
    queryKey: ['conversations'],
    queryFn: async () =>
      must(await sb().from('conversations').select('id,title,updated_at').order('updated_at', { ascending: false }).limit(50)) as {
        id: string
        title: string
        updated_at: string
      }[],
  })
  const msgs = useQuery({
    queryKey: ['messages', active],
    enabled: Boolean(active),
    queryFn: async () => must(await sb().from('messages').select('*').eq('conversation_id', active!).order('created_at')) as Message[],
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.data, pending])

  async function submit(text: string) {
    const content = text.trim()
    if (!content || pending) return
    setDraft('')
    setPending(content)
    try {
      const res = await send({ data: { conversationId: active, content } })
      setActive(res.conversationId)
      await qc.invalidateQueries({ queryKey: ['messages', res.conversationId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      if (res.memoriesSaved) toast.success(`Vincify remembered ${res.memoriesSaved} new detail${res.memoriesSaved > 1 ? 's' : ''}. Manage in Settings.`)
    } catch (e) {
      setDraft(content)
      toast.error(e instanceof Error ? e.message : 'The assistant is unavailable')
    } finally {
      setPending(null)
    }
  }

  async function removeConv(id: string) {
    if (!confirm('Delete this conversation?')) return
    const { error } = await sb().from('conversations').delete().eq('id', id)
    if (error) return toast.error(error.message)
    if (active === id) setActive(null)
    qc.invalidateQueries({ queryKey: ['conversations'] })
  }

  const list = active ? (msgs.data ?? []) : []

  return (
    <div className="mx-auto grid h-[calc(100svh-8.5rem)] max-w-content gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden flex-col rounded-2xl border bg-card p-3 shadow-soft lg:flex">
        <Button variant="outline" className="mb-3 w-full justify-start" onClick={() => setActive(null)}>
          <MessageSquarePlus /> New conversation
        </Button>
        <ul className="flex-1 space-y-0.5 overflow-y-auto">
          {convs.data?.map((c) => (
            <li key={c.id} className="group flex items-center">
              <button
                onClick={() => setActive(c.id)}
                className={cn('min-w-0 flex-1 truncate rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted', active === c.id && 'bg-accent text-accent-foreground')}
              >
                {c.title}
              </button>
              <button aria-label={`Delete ${c.title}`} onClick={() => removeConv(c.id)} className="p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-0 flex-col rounded-2xl border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <LogoMark size={22} />
          <span className="text-sm font-semibold">Vincify AI</span>
          <select
            aria-label="Conversation"
            className="ml-auto h-8 max-w-[50%] rounded-md border bg-background px-1.5 text-xs lg:hidden"
            value={active ?? ''}
            onChange={(e) => setActive(e.target.value || null)}
          >
            <option value="">New conversation</option>
            {convs.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {list.length === 0 && !pending && (
            <div className="mx-auto max-w-lg pt-8 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                <Bot className="size-6" />
              </span>
              <h1 className="mt-4 text-lg font-semibold">How can I help you today?</h1>
              <p className="mt-1 text-sm text-muted-foreground">I can see your tasks, events, goals and what you have asked me to remember.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => submit(s)} className="rounded-xl border bg-background p-3 text-left text-sm hover:border-primary/40">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {list.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ))}
          {pending && (
            <>
              <Bubble role="user" content={pending} />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Thinking
              </div>
            </>
          )}
          <div ref={endRef} />
        </div>
        <form
          className="border-t p-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit(draft)
          }}
        >
          <div className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-[3px] focus-within:ring-ring/50">
            <label htmlFor="chat-input" className="sr-only">
              Message Vincify AI
            </label>
            <textarea
              id="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit(draft)
                }
              }}
              rows={1}
              maxLength={8000}
              placeholder="Ask anything about your work and plans"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <Button type="submit" size="icon-sm" variant="brand" disabled={!draft.trim() || Boolean(pending)} aria-label="Send">
              <ArrowUp />
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  return role === 'user' ? (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm whitespace-pre-wrap text-ink-foreground">{content}</div>
    </div>
  ) : (
    <div className="flex gap-3">
      <LogoMark size={24} className="mt-0.5" />
      <div className="min-w-0 flex-1 text-sm">
        <Markdown content={content} />
      </div>
    </div>
  )
}
