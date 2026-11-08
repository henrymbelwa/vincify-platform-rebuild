import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { createClient, type User } from '@supabase/supabase-js'
import { sb } from '@/lib/supabase'

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization')
    }
    headers.set('apikey', supabaseKey)
    return fetch(input, { ...init, headers })
  }
}

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Validates a Bearer token with Supabase Auth.
 * Fails closed: any error (network failure, timeout, invalid signature, expired token)
 * results in rejection without constructing an authenticated context.
 */
export async function authenticateToken(token: string, supabaseUrl?: string, supabaseKey?: string, customClient?: any): Promise<{ supabase: any; user: User }> {
  if (!token) {
    throw new AuthError('Unauthorized: Missing bearer token', 401)
  }

  const url = supabaseUrl || process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL']
  const key = supabaseKey || process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY']
  if (!url || !key) {
    throw new AuthError('Server configuration error: missing Supabase credentials', 500)
  }

  const supabase = customClient || createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: createSupabaseFetch(key),
      headers: { Authorization: `Bearer ${token}` },
    },
  })

  let user: User | null = null

  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data?.user) {
      throw new AuthError(error?.message || 'Unauthorized: Token validation failed', 401)
    }
    user = data.user
  } catch (err: any) {
    if (err instanceof AuthError) {
      throw err
    }
    // Network or service failure: fail closed with 503 Service Unavailable
    throw new AuthError(
      'Authentication service unavailable: Failed to connect to Supabase Auth',
      503,
    )
  }

  if (!user) {
    throw new AuthError('Unauthorized: Token verification failed', 401)
  }

  return { supabase, user }
}

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
  if (!token) throw new AuthError('Unauthorized: Missing token', 401)

  const { supabase, user } = await authenticateToken(token)

  return next({ context: { supabase, user } })
})
