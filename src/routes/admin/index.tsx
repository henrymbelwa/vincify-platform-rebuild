import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  DollarSign,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react'
import { PageHeader, Panel, Stat } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { getAdminMetrics } from '@/lib/admin.functions'

export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: 'Overview - Vincify Admin' }] }),
  component: AdminOverviewPage,
})

function AdminOverviewPage() {
  const metrics = useQuery({
    queryKey: ['admin_metrics'],
    queryFn: () => getAdminMetrics(),
    refetchInterval: 30_000,
  })

  const m = metrics.data

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Overview"
        description="Real-time multi-user telemetry, AI consumption metrics and operational health."
        action={
          <Link to="/admin/ai">
            <Button size="sm">
              <Cpu className="size-4 mr-1.5" />
              AI Control Centre
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Total Users"
          value={m ? m.totalUsers : '...'}
          icon={<Users className="size-4 text-brand-purple" />}
        />
        <Stat
          label="AI Invocations"
          value={m ? m.totalAiRequests : '...'}
          icon={<Bot className="size-4 text-brand-pink" />}
        />
        <Stat
          label="Tokens Consumed"
          value={m ? m.totalTokens.toLocaleString() : '...'}
          icon={<Activity className="size-4 text-indigo-500" />}
        />
        <Stat
          label="Estimated Cost"
          value={m ? `$${m.estimatedCostUsd}` : '...'}
          icon={<DollarSign className="size-4 text-emerald-500" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Document Processing Telemetry" description="Breakdown of document & timetable analysis jobs">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Total Uploaded Documents</span>
              <span className="font-semibold">{m ? m.totalDocs : '...'}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-sm">Processed Successfully</span>
              </div>
              <span className="font-semibold text-emerald-500">{m ? m.successfulDocs : '...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-500" />
                <span className="text-sm">Failed Document Requests</span>
              </div>
              <span className="font-semibold text-rose-500">{m ? m.failedDocs : '...'}</span>
            </div>
          </div>
        </Panel>

        <Panel title="AI Engine Reliability" description="Status and error rate across active providers">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Failed AI Requests</span>
              <span className="font-semibold text-rose-500">{m ? m.failedAiRequests : '...'}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-medium">Success Rate</span>
              <span className="font-semibold text-emerald-500">
                {m && m.totalAiRequests > 0
                  ? `${(((m.totalAiRequests - m.failedAiRequests) / m.totalAiRequests) * 100).toFixed(1)}%`
                  : '100%'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Status</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                All Systems Operational
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
