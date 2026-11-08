import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Search, UserCheck, UserX, Users } from 'lucide-react'
import { PageHeader, Panel } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminUsers } from '@/lib/admin.functions'

export const Route = createFileRoute('/admin/users')({
  head: () => ({ meta: [{ title: 'User Management - Vincify Admin' }] }),
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const [search, setSearch] = useState('')

  const users = useQuery({
    queryKey: ['admin_users', search],
    queryFn: () => getAdminUsers({ data: { search: search || undefined, limit: 100 } }),
  })

  const list = users.data?.users ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="View registered accounts, verify onboarding state, and inspect account timestamps."
      />

      <div className="flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Panel title={`Registered Users (${list.length})`} description="Privacy protected: passwords and private messages are inaccessible.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold uppercase text-muted-foreground">
                <th className="pb-3">User</th>
                <th className="pb-3">Occupation</th>
                <th className="pb-3">Timezone</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No users found matching query
                  </td>
                </tr>
              ) : (
                list.map((u: any) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="py-3 font-medium">
                      <div>{u.full_name || u.preferred_name || 'Anonymous User'}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{u.id}</div>
                    </td>
                    <td className="py-3 text-muted-foreground">{u.occupation || 'Not specified'}</td>
                    <td className="py-3 text-muted-foreground font-mono">{u.timezone || 'UTC'}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          u.onboarded
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}
                      >
                        {u.onboarded ? 'Active / Onboarded' : 'Pending Onboarding'}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
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
