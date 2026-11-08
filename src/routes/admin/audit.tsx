import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { PageHeader, Panel } from '@/components/app/page'
import { getAdminAuditLogs } from '@/lib/admin.functions'

export const Route = createFileRoute('/admin/audit')({
  head: () => ({ meta: [{ title: 'Audit Logs - Vincify Admin' }] }),
  component: AdminAuditPage,
})

function AdminAuditPage() {
  const auditLogs = useQuery({
    queryKey: ['admin_audit_logs'],
    queryFn: () => getAdminAuditLogs({ data: { limit: 100 } }),
  })

  const list = auditLogs.data?.logs ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrative Audit Logs"
        description="Immutable record of security events, configuration modifications, and administrative operations."
      />

      <Panel title={`Audit Events (${list.length})`} description="Logged with administrator identity, timestamp, and action parameters.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold uppercase text-muted-foreground">
                <th className="pb-3">Action</th>
                <th className="pb-3">Administrator</th>
                <th className="pb-3">Target</th>
                <th className="pb-3">Details</th>
                <th className="pb-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No administrative audit events recorded yet
                  </td>
                </tr>
              ) : (
                list.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="py-3 font-medium">
                      <span className="font-mono text-xs rounded bg-muted px-1.5 py-0.5">{log.action}</span>
                    </td>
                    <td className="py-3 text-muted-foreground">{log.admin_email || log.admin_id || 'System'}</td>
                    <td className="py-3 font-mono text-[11px] text-muted-foreground">
                      {log.target_type} {log.target_id ? `(${log.target_id})` : ''}
                    </td>
                    <td className="py-3 font-mono text-[11px] max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(log.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
