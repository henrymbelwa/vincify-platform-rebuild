import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUser } from './auth-middleware'
import { adminClient } from './server/admin.server'
import { encryptSecret } from './server/crypto.server'
import { testProviderConnection, type AiProvider, type ProviderConfig } from './server/ai.server'

async function assertAdminUser(userId: string, email?: string) {
  const db = adminClient()
  const { data: adminRecord } = await db
    .from('admin_users')
    .select('role, is_active')
    .eq('id', userId)
    .eq('is_active', true)
    .maybeSingle()

  const initialEmail = (process.env['INITIAL_ADMIN_EMAIL'] || 'adminvincify@gmail.com').toLowerCase().trim()
  const userEmail = (email || '').toLowerCase().trim()

  if (!adminRecord && initialEmail !== userEmail) {
    throw new Error('Forbidden: Administrative access required')
  }

  return adminRecord?.role || 'superadmin'
}

/** Fetch administrative metrics */
export const getAdminMetrics = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await assertAdminUser(context.user.id, context.user.email)
    const db = adminClient()

    const [usersRes, docsRes, aiRes, errorRes] = await Promise.all([
      db.from('profiles').select('id, created_at', { count: 'exact' }),
      db.from('documents').select('id, status', { count: 'exact' }),
      db.from('ai_usage_events').select('id, total_tokens, estimated_cost_usd, status'),
      db.from('ai_usage_events').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ])

    const totalUsers = usersRes.count ?? 0
    const totalDocs = docsRes.count ?? 0
    const successfulDocs = (docsRes.data ?? []).filter((d) => d.status === 'ready').length
    const failedDocs = (docsRes.data ?? []).filter((d) => d.status === 'failed').length

    const aiEvents = aiRes.data ?? []
    const totalAiRequests = aiEvents.length
    const totalTokens = aiEvents.reduce((acc, ev) => acc + (ev.total_tokens || 0), 0)
    const estimatedCostUsd = aiEvents.reduce((acc, ev) => acc + Number(ev.estimated_cost_usd || 0), 0)
    const failedAiRequests = errorRes.count ?? 0

    return {
      totalUsers,
      totalDocs,
      successfulDocs,
      failedDocs,
      totalAiRequests,
      totalTokens,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
      failedAiRequests,
    }
  })

/** Fetch users with pagination and search */
export const getAdminUsers = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ search: z.string().optional(), limit: z.number().default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdminUser(context.user.id, context.user.email)
    const db = adminClient()

    let query = db
      .from('profiles')
      .select('id, full_name, preferred_name, occupation, onboarded, created_at, timezone')
      .order('created_at', { ascending: false })
      .limit(data.limit)

    if (data.search?.trim()) {
      query = query.or(`full_name.ilike.%${data.search.trim()}%,preferred_name.ilike.%${data.search.trim()}%`)
    }

    const { data: users, error } = await query
    if (error) throw new Error(error.message)

    return { users: users ?? [] }
  })

/** Fetch document processing monitoring logs */
export const getAdminDocuments = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ limit: z.number().default(50) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdminUser(context.user.id, context.user.email)
    const db = adminClient()

    const { data: docs, error } = await db
      .from('documents')
      .select('id, user_id, name, mime_type, size_bytes, status, summary, created_at')
      .order('created_at', { ascending: false })
      .limit(data.limit)

    if (error) throw new Error(error.message)
    return { documents: docs ?? [] }
  })

/** Get current AI configurations */
export const getAdminAiConfig = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await assertAdminUser(context.user.id, context.user.email)
    const db = adminClient()

    const { data } = await db.from('ai_configurations').select('*').eq('id', 'default').maybeSingle()
    return {
      activeProvider: data?.active_provider || 'gemini',
      modelName: data?.model_name || 'gemini-3.5-flash-lite',
      fallbackProvider: data?.fallback_provider || null,
      fallbackEnabled: data?.fallback_enabled ?? false,
      apiBaseUrl: data?.api_base_url || '',
      timeoutMs: data?.timeout_ms || 45000,
      dailyAnalysisLimit: data?.daily_analysis_limit || 3,
      hasCustomKey: Boolean(data?.encrypted_api_key),
    }
  })

/** Update AI Configuration securely */
export const updateAdminAiConfig = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        activeProvider: z.enum(['gemini', 'openai', 'anthropic', 'groq', 'openrouter', 'custom']),
        modelName: z.string().min(1).max(100),
        apiKey: z.string().optional(),
        apiBaseUrl: z.string().url().or(z.literal('')).optional(),
        fallbackProvider: z.string().nullable().optional(),
        fallbackEnabled: z.boolean().default(false),
        timeoutMs: z.number().min(5000).max(120000).default(45000),
        dailyAnalysisLimit: z.number().min(1).max(50).default(3),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminUser(context.user.id, context.user.email)
    const db = adminClient()

    const updatePayload: any = {
      active_provider: data.activeProvider,
      model_name: data.modelName,
      fallback_provider: data.fallbackProvider || null,
      fallback_enabled: data.fallbackEnabled,
      api_base_url: data.apiBaseUrl || null,
      timeout_ms: data.timeoutMs,
      daily_analysis_limit: data.dailyAnalysisLimit,
      updated_by: context.user.id,
      updated_at: new Date().toISOString(),
    }

    if (data.apiKey?.trim()) {
      updatePayload.encrypted_api_key = encryptSecret(data.apiKey.trim())
    }

    const { error } = await db.from('ai_configurations').upsert({ id: 'default', ...updatePayload })
    if (error) throw new Error(error.message)

    await db.from('admin_audit_logs').insert({
      admin_id: context.user.id,
      admin_email: context.user.email,
      action: 'UPDATE_AI_CONFIG',
      target_type: 'ai_configurations',
      target_id: 'default',
      details: {
        activeProvider: data.activeProvider,
        modelName: data.modelName,
        fallbackEnabled: data.fallbackEnabled,
      },
    })

    return { ok: true }
  })

/** Test AI provider connection directly from admin interface */
export const testAdminAiProvider = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider: z.enum(['gemini', 'openai', 'anthropic', 'groq', 'openrouter', 'custom']),
        model: z.string(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminUser(context.user.id, context.user.email)

    const cfg: ProviderConfig = {
      provider: data.provider as AiProvider,
      model: data.model,
      apiKey: data.apiKey?.trim() || '',
      baseUrl: data.baseUrl || undefined,
    }

    // If key omitted in request, pull existing configured key
    if (!cfg.apiKey) {
      const { getEnvApiKeyForProvider, getActiveAiConfig } = await import('./server/ai.server')
      const envKey = getEnvApiKeyForProvider(cfg.provider)
      if (envKey) {
        cfg.apiKey = envKey
      } else {
        const active = await getActiveAiConfig()
        if (active.primary.provider === cfg.provider && active.primary.apiKey) {
          cfg.apiKey = active.primary.apiKey
        }
      }
    }

    return testProviderConnection(cfg)
  })

/** Fetch audit logs */
export const getAdminAuditLogs = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ limit: z.number().default(50) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdminUser(context.user.id, context.user.email)
    const db = adminClient()

    const { data: logs, error } = await db
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(data.limit)

    if (error) throw new Error(error.message)
    return { logs: logs ?? [] }
  })
