import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { PageHeader, Panel } from '@/components/app/page'
import { getAdminDocuments } from '@/lib/admin.functions'

export const Route = createFileRoute('/admin/documents')({
  head: () => ({ meta: [{ title: 'Document Monitoring - Vincify Admin' }] }),
  component: AdminDocumentsPage,
})

function AdminDocumentsPage() {
  const docs = useQuery({
    queryKey: ['admin_documents'],
    queryFn: () => getAdminDocuments({ data: { limit: 100 } }),
  })

  const list = docs.data?.documents ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Management & Processing Monitor"
        description="Audit document ingestion, file sizes, MIME types, and automated processing pipelines."
      />

      <Panel title={`Uploaded Documents (${list.length})`} description="Private storage is enforced under RLS. Document contents are strictly protected.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold uppercase text-muted-foreground">
                <th className="pb-3">File Name</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Size</th>
                <th className="pb-3">Owner ID</th>
                <th className="pb-3">Processing Status</th>
                <th className="pb-3">Upload Date</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No documents uploaded yet
                  </td>
                </tr>
              ) : (
                list.map((d: any) => (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="py-3 font-medium flex items-center gap-2">
                      <FileText className="size-4 text-brand-purple" />
                      <span className="truncate max-w-xs">{d.name}</span>
                    </td>
                    <td className="py-3 font-mono text-muted-foreground">{d.mime_type}</td>
                    <td className="py-3 font-mono">{(d.size_bytes / 1024).toFixed(1)} KB</td>
                    <td className="py-3 font-mono text-[10px] text-muted-foreground">{d.user_id.slice(0, 8)}...</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          d.status === 'ready'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : d.status === 'failed'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
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
