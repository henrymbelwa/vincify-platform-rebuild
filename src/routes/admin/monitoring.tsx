import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, Cpu, DollarSign, Layers } from 'lucide-react'
import { PageHeader, Panel, Stat } from '@/components/app/page'
import { getAdminMetrics } from '@/lib/admin.functions'

export const Route = createFileRoute('/admin/monitoring')({
  head: () => ({ meta: [{ title: 'API & Resource Monitor - Vincify Admin' }] }),
  component: AdminMonitoringPage,
})

function AdminMonitoringPage() {
  const metrics = useQuery({
    queryKey: ['admin_metrics'],
    queryFn: () => getAdminMetrics(),
    refetchInterval: 15_000,
  })

  const m = metrics.data

  return (
    <div className="space-y-8">
      <PageHeader
        title="API & Resource Monitor"
        description="Continuous usage tracking, token accounting, error rate detection, and expenditure estimates."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Total AI Invocations"
          value={m ? m.totalAiRequests : '...'}
          icon={<Cpu className="size-4 text-brand-purple" />}
        />
        <Stat
          label="Estimated Token Count"
          value={m ? m.totalTokens.toLocaleString() : '...'}
          icon={<Layers className="size-4 text-brand-pink" />}
        />
        <Stat
          label="Total Estimated Cost"
          value={m ? `$${m.estimatedCostUsd}` : '...'}
          icon={<DollarSign className="size-4 text-emerald-500" />}
        />
        <Stat
          label="Failed Requests"
          value={m ? m.failedAiRequests : '...'}
          icon={<Activity className="size-4 text-rose-500" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Billing & Rate Limiting Awareness" description="Cost attribution policies">
          <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              Costs are estimated dynamically from token metadata returned by each provider API.
              Requests with failed status are recorded but excluded from successful billing quotas.
            </p>
            <div className="rounded-lg border p-3 font-mono text-[11px] space-y-1 bg-muted/20">
              <div>Google Gemini: ~$0.0001 per 1k tokens</div>
              <div>OpenAI GPT-4o-mini: ~$0.0006 per 1k tokens</div>
              <div>Anthropic Claude 3.5: ~$0.0030 per 1k tokens</div>
              <div>Groq / OpenRouter: ~$0.0002 per 1k tokens</div>
            </div>
            <p>
              * All figures are approximate operational telemetry to prevent runaway expenses.
            </p>
          </div>
        </Panel>

        <Panel title="Daily Limits & Hard Caps" description="System quotas protecting downstream budgets">
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>
              Document analysis is protected by the atomic database procedure{' '}
              <code className="text-foreground font-mono">reserve_document_analysis</code>, enforcing a default cap of 3
              successful analyses per user per day.
            </p>
            <p>
              Chat messages are rate-limited and contextual history is capped to the 10 most recent turns to minimize token footprint.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
