import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isConfigured = Boolean(url && key)

let client: SupabaseClient | null = null

/** Browser Supabase client. All reads and writes run under Row Level Security as the signed-in user. */
export function sb(): SupabaseClient {
  if (!isConfigured) throw new Error('Vincify is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  if (!client) {
    client = createClient(url!, key!, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
        detectSessionInUrl: typeof window !== 'undefined',
        flowType: 'pkce',
      },
    })
  }
  return client
}

export async function currentUserId(): Promise<string> {
  const { data } = await sb().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('You are signed out. Please sign in again.')
  return id
}

/** Throws a readable error when a Supabase call fails. */
export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}
