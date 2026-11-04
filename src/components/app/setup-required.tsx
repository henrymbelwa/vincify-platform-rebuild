import { Logo } from '@/components/brand/logo'

/** Shown only when the deployment is missing its Supabase configuration. */
export function SetupRequired() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-lg space-y-5 rounded-2xl border bg-card p-8 shadow-soft">
        <Logo size={28} />
        <h1 className="text-xl font-semibold">Configuration required</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This deployment has no database connection yet. Add the variables from <code>.env.example</code> to your
          environment, apply the SQL in <code>supabase/migrations</code> to your Supabase project, then redeploy.
        </p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <code>VITE_SUPABASE_URL</code>
          </li>
          <li>
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
          </li>
        </ul>
      </div>
    </main>
  )
}
