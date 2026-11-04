import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Gift, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, PageHeader, Panel, Stat } from '@/components/app/page'
import { must, sb } from '@/lib/supabase'
import { useUser } from '@/lib/auth'

export const Route = createFileRoute('/app/rewards')({
  head: () => ({ meta: [{ title: 'Invite Friends & Rewards - Vincify' }] }),
  component: Rewards,
})

function Rewards() {
  const user = useUser()
  const code = useQuery({
    queryKey: ['referral_code'],
    queryFn: async () => (must(await sb().from('referral_codes').select('code').maybeSingle()) as { code: string } | null)?.code ?? null,
  })
  const referrals = useQuery({
    queryKey: ['referrals'],
    queryFn: async () => must(await sb().from('referrals').select('id,status,created_at,qualified_at,referrer_id').order('created_at', { ascending: false })) as {
      id: string
      status: 'pending' | 'qualified' | 'rejected'
      created_at: string
      referrer_id: string
    }[],
  })
  const ledger = useQuery({
    queryKey: ['reward_transactions'],
    queryFn: async () => must(await sb().from('reward_transactions').select('*').order('created_at', { ascending: false })) as {
      id: string
      points: number
      reason: string
      created_at: string
    }[],
  })

  const link = code.data && typeof window !== 'undefined' ? `${window.location.origin}/auth?mode=signup&ref=${code.data}` : ''
  const mine = (referrals.data ?? []).filter((r) => r.referrer_id === user.id)
  const points = (ledger.data ?? []).reduce((a, b) => a + b.points, 0)

  return (
    <div className="mx-auto max-w-content space-y-6">
      <PageHeader title="Invite Friends & Rewards" description="Earn 100 points when a friend verifies their email, completes onboarding and finishes 3 tasks. They get 50." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Points balance" value={points} />
        <Stat label="Invited" value={mine.length} />
        <Stat label="Qualified" value={mine.filter((r) => r.status === 'qualified').length} />
        <Stat label="Pending" value={mine.filter((r) => r.status === 'pending').length} />
      </div>
      <Panel title="Your invite link">
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="flex-1 truncate rounded-lg border bg-muted px-3 py-2 text-sm">{link || 'Loading'}</code>
          <Button
            variant="outline"
            disabled={!link}
            onClick={async () => {
              await navigator.clipboard.writeText(link)
              toast.success('Link copied')
            }}
          >
            <Copy /> Copy
          </Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button variant="brand" disabled={!link} onClick={() => navigator.share({ title: 'Join me on Vincify', url: link }).catch(() => {})}>
              <Share2 /> Share
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Your code: {code.data}. Self-referrals and duplicate accounts never qualify.</p>
      </Panel>
      <Panel title="Points history">
        {!ledger.data?.length ? (
          <Empty icon={Gift} title="No points yet" body="Points appear here when a referral qualifies." />
        ) : (
          <ul className="divide-y text-sm">
            {ledger.data.map((l) => (
              <li key={l.id} className="flex justify-between py-2.5">
                <span>{l.reason}</span>
                <span className="font-medium text-success">+{l.points}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
