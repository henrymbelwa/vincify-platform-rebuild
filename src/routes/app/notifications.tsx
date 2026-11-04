import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, LoadingRows, PageHeader, Panel } from '@/components/app/page'
import { must, sb } from '@/lib/supabase'
import type { Notification } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/notifications')({
  head: () => ({ meta: [{ title: 'Notifications - Vincify' }] }),
  component: Notifications,
})

function Notifications() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => must(await sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as Notification[],
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] })
  const markAll = async () => {
    await sb().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    refresh()
  }
  const markRead = async (id: string) => {
    await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    refresh()
  }

  return (
    <div className="mx-auto max-w-reading">
      <PageHeader
        title="Notifications"
        description="Reminders, automation results and rewards. Choose what you receive in Settings."
        actions={
          <Button variant="outline" size="sm" onClick={markAll} disabled={!q.data?.some((n) => !n.read_at)}>
            <CheckCheck /> Mark all read
          </Button>
        }
      />
      <Panel>
        {q.isLoading ? (
          <LoadingRows />
        ) : !q.data?.length ? (
          <Empty icon={Bell} title="You are all caught up" />
        ) : (
          <ul className="divide-y">
            {q.data.map((n) => (
              <li key={n.id} className={cn('flex gap-3 py-3', !n.read_at && 'font-medium')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-pink')} />
                <div className="min-w-0 flex-1">
                  {n.link ? (
                    <Link to={n.link} onClick={() => markRead(n.id)} className="text-sm hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm">{n.title}</p>
                  )}
                  {n.body && <p className="mt-0.5 text-sm font-normal text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs font-normal text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete notification"
                  onClick={async () => {
                    await sb().from('notifications').delete().eq('id', n.id)
                    refresh()
                  }}
                >
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
