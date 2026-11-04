import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import { sb } from '@/lib/supabase'

/** Client side: attach the current access token to every server function call. */
export const attachBearer = createMiddleware({ type: 'function' }).client(async ({ next }) => {
  const { data } = await sb().auth.getSession()
  const token = data.session?.access_token
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} })
})

/** Server side: verify the token and expose a Supabase client that runs under RLS as that user. */
export const requireUser = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const header = getRequestHeader('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new Error('Unauthorized')
  const url = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL']
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY']
  if (!url || !key) throw new Error('Server is missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY')
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new Error('Unauthorized')
  return next({ context: { supabase, user: data.user } })
})
