import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isConfigured, sb } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthValue {
  session: Session | null
  ready: boolean
  profile: Profile | null
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  session: null,
  ready: false,
  profile: null,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isConfigured)
  const qc = useQueryClient()

  useEffect(() => {
    if (!isConfigured) return
    const client = sb()
    client.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = client.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_OUT') qc.clear()
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') qc.invalidateQueries()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  const uid = session?.user.id
  const profileQ = useQuery({
    queryKey: ['profile', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { data, error } = await sb().from('profiles').select('*').eq('id', uid!).maybeSingle()
      if (error) throw new Error(error.message)
      return data as Profile | null
    },
  })

  const value = useMemo<AuthValue>(
    () => ({
      session,
      ready: ready && (!uid || !profileQ.isLoading),
      profile: profileQ.data ?? null,
      refreshProfile: async () => {
        await profileQ.refetch()
      },
    }),
    [session, ready, uid, profileQ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export function useUser() {
  const { session, profile } = useAuth()
  if (!session) throw new Error('useUser requires a signed-in user')
  const meta = session.user.user_metadata as { full_name?: string; name?: string }
  const fullName = profile?.full_name || meta.full_name || meta.name || session.user.email || ''
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    fullName,
    preferredName: profile?.preferred_name || fullName.split(' ')[0] || '',
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    profile,
  }
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || 'V'
  )
}

export async function signOut(navigate: (to: string) => void) {
  await sb().auth.signOut()
  navigate('/auth')
}
