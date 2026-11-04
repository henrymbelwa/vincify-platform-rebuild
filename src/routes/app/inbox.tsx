import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Inbox as InboxIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Empty, LoadingRows, PageHeader, Panel } from '@/components/app/page'
import { useTaskMutations, useTasks } from '@/lib/queries'

export const Route = createFileRoute('/app/inbox')({
  head: () => ({ meta: [{ title: 'Inbox - Vincify' }] }),
  component: InboxPage,
})

const INBOX = 'Inbox'

function InboxPage() {
  const tasks = useTasks()
  const { create, update, remove } = useTaskMutations()
  const [text, setText] = useState('')
  const items = (tasks.data ?? []).filter((t) => t.category === INBOX && t.status !== 'completed' && t.status !== 'cancelled')

  return (
    <div className="mx-auto max-w-reading">
      <PageHeader title="Inbox" description="Capture first, organise later. Items here are not scheduled yet." />
      <Panel>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const title = text.trim()
            if (!title) return
            create.mutate({ title: title.slice(0, 200), priority: 'medium', category: INBOX }, { onSuccess: () => setText('') })
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="What is on your mind?" aria-label="Capture" maxLength={200} />
          <Button type="submit" variant="brand" disabled={create.isPending}>
            Capture
          </Button>
        </form>
        {tasks.isLoading ? (
          <LoadingRows />
        ) : items.length === 0 ? (
          <Empty icon={InboxIcon} title="Inbox zero" body="Everything captured has been organised." />
        ) : (
          <ul className="divide-y">
            {items.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-3">
                <span className="min-w-0 flex-1 text-sm">{t.title}</span>
                <Button size="xs" variant="outline" onClick={() => update.mutate({ id: t.id, patch: { category: null, due_at: new Date(new Date().setHours(17, 0, 0, 0)).toISOString() } })}>
                  Do today
                </Button>
                <Button size="xs" variant="outline" onClick={() => update.mutate({ id: t.id, patch: { category: null } })}>
                  Move to tasks
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label={`Delete ${t.title}`} onClick={() => remove.mutate(t.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
