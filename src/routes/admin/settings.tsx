import { createFileRoute } from '@tanstack/react-router'
import { Check, ShieldCheck, Sliders } from 'lucide-react'
import { PageHeader, Panel } from '@/components/app/page'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/settings')({
  head: () => ({ meta: [{ title: 'System Settings - Vincify Admin' }] }),
  component: AdminSettingsPage,
})

function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="System Settings"
        description="Global platform toggles, security headers, SMTP status, and scheduled runner health."
      />

      <Panel title="Platform Configuration" description="Environment-level service parameters">
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <div className="font-medium text-sm text-foreground">Initial Administrator</div>
              <div className="text-muted-foreground">Controlled via INITIAL_ADMIN_EMAIL</div>
            </div>
            <span className="font-mono text-muted-foreground">adminvincify@gmail.com</span>
          </div>

          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <div className="font-medium text-sm text-foreground">Scheduled Cron Runner</div>
              <div className="text-muted-foreground">Protected via CRON_SECRET at /api/cron/automations</div>
            </div>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-500 font-medium">Configured</span>
          </div>

          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <div className="font-medium text-sm text-foreground">SMTP Transactional Email</div>
              <div className="text-muted-foreground">Used for notifications, automated digests and verification</div>
            </div>
            <span className="text-muted-foreground font-mono">SMTP_HOST / SMTP_PORT</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-foreground">Vercel Deployment Compatibility</div>
              <div className="text-muted-foreground">Nitro preset configured in vercel.json</div>
            </div>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-500 font-medium">Active</span>
          </div>
        </div>
      </Panel>
    </div>
  )
}
