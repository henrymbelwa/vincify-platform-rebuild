/**
 * Vincify Multi-Provider AI Architecture (server-only).
 * Supports:
 * 1. Google Gemini (REST / Native)
 * 2. OpenAI
 * 3. Anthropic Claude
 * 4. Groq
 * 5. OpenRouter
 * 6. Custom OpenAI-compatible endpoints
 */

import { decryptSecret } from './crypto.server'

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface InlineFile {
  mimeType: string
  /** Base64-encoded bytes. */
  data: string
}

export type AiErrorCode =
  | 'config'
  | 'bad_request'
  | 'auth'
  | 'model'
  | 'rate_limit'
  | 'unavailable'
  | 'timeout'
  | 'blocked'
  | 'empty'

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'custom'

export interface ProviderConfig {
  provider: AiProvider
  model: string
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
}

export interface GenerationOptions {
  files?: InlineFile[]
  schema?: object
  userId?: string
  feature?: 'assistant' | 'document_summary' | 'timetable_analysis' | 'system_test'
}

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_TIMEOUT_MS = 45000

function env(name: string) {
  return process.env[name]?.trim() || ''
}

// ---------------- Gemini helper functions preserved for backward compatibility & tests ----------------
type Part = { text: string } | { inlineData: InlineFile }
interface Content {
  role: 'user' | 'model'
  parts: Part[]
}

/** Builds a generateContent body: system turns become systemInstruction, same-role turns merge, and the request ends on a user turn. */
export function buildRequest(turns: ChatTurn[], opts: { files?: InlineFile[]; schema?: object } = {}) {
  const system = turns
    .filter((t) => t.role === 'system')
    .map((t) => t.content)
    .join('\n\n')
  const contents: Content[] = []
  for (const t of turns) {
    if (t.role === 'system' || !t.content.trim()) continue
    const role = t.role === 'assistant' ? 'model' : 'user'
    const last = contents[contents.length - 1]
    if (last && last.role === role) {
      const text = last.parts[0] as { text: string }
      text.text = `${text.text}\n\n${t.content}`
    } else contents.push({ role, parts: [{ text: t.content }] })
  }
  if (!contents.length || contents[contents.length - 1]!.role !== 'user') {
    contents.push({ role: 'user', parts: [{ text: 'Continue.' }] })
  }
  if (opts.files?.length) contents[contents.length - 1]!.parts.push(...opts.files.map((f) => ({ inlineData: f })))
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    ...(opts.schema ? { generationConfig: { responseMimeType: 'application/json', responseSchema: opts.schema } } : {}),
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const secs = Number(value)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(value)
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now())
}

/** Maps a non-OK status code or retry-after to a safe, user-readable error. */
export function errorFromStatus(status: number, retryAfter?: string | null): AiError {
  const ra = parseRetryAfter(retryAfter ?? null)
  if (status === 400) return new AiError('bad_request', 'The AI service could not process this request or file.', status)
  if (status === 401 || status === 403) return new AiError('auth', 'The AI service key is invalid or not authorised. Check provider credentials.', status)
  if (status === 404) return new AiError('model', 'The configured AI model is not available.', status)
  if (status === 429) {
    const wait = ra ? ` Try again in about ${Math.ceil(ra / 1000)} seconds.` : ' Please try again later.'
    return new AiError('rate_limit', `The AI service rate limit or quota has been reached.${wait}`, status, ra)
  }
  if (status >= 500) return new AiError('unavailable', 'The AI service is temporarily unavailable. Please try again shortly.', status, ra)
  return new AiError('unavailable', `The AI service returned an unexpected error (${status}).`, status)
}

export function isRetryable(e: AiError) {
  return e.code === 'rate_limit' || e.code === 'unavailable'
}

interface GeminiResponse {
  promptFeedback?: { blockReason?: string }
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

/** Extracts the reply text, raising for blocked or empty responses. */
export function readReply(body: GeminiResponse): string {
  if (body.promptFeedback?.blockReason) throw new AiError('blocked', 'The AI service declined this request for safety reasons.')
  const c = body.candidates?.[0]
  if (c?.finishReason === 'SAFETY' || c?.finishReason === 'PROHIBITED_CONTENT') {
    throw new AiError('blocked', 'The AI service declined this request for safety reasons.')
  }
  const text = (c?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim()
  if (!text) throw new AiError('empty', 'The AI service returned an empty reply.')
  return text
}

// ---------------- Configuration management ----------------
export async function getActiveAiConfig(): Promise<{ primary: ProviderConfig; fallback?: ProviderConfig }> {
  try {
    const { adminClient } = await import('./admin.server')
    const db = adminClient()
    const { data } = await db.from('ai_configurations').select('*').eq('id', 'default').maybeSingle()
    if (data && data.active_provider) {
      let apiKey = ''
      if (data.encrypted_api_key) {
        apiKey = decryptSecret(data.encrypted_api_key)
      } else {
        apiKey = getEnvApiKeyForProvider(data.active_provider as AiProvider)
      }

      const primary: ProviderConfig = {
        provider: data.active_provider as AiProvider,
        model: data.model_name || getDefaultModelForProvider(data.active_provider as AiProvider),
        apiKey,
        baseUrl: data.api_base_url || undefined,
        timeoutMs: data.timeout_ms || DEFAULT_TIMEOUT_MS,
      }

      let fallback: ProviderConfig | undefined
      if (data.fallback_enabled && data.fallback_provider) {
        const fbKey = getEnvApiKeyForProvider(data.fallback_provider as AiProvider)
        fallback = {
          provider: data.fallback_provider as AiProvider,
          model: getDefaultModelForProvider(data.fallback_provider as AiProvider),
          apiKey: fbKey,
        }
      }

      return { primary, fallback }
    }
  } catch {
    // If DB is unreachable or uninitialized, fallback to environment variables
  }

  return {
    primary: {
      provider: 'gemini',
      model: env('GEMINI_MODEL') || DEFAULT_MODEL,
      apiKey: env('GEMINI_API_KEY'),
      timeoutMs: Number(env('GEMINI_TIMEOUT_MS')) || DEFAULT_TIMEOUT_MS,
    },
  }
}

export function getEnvApiKeyForProvider(p: AiProvider): string {
  switch (p) {
    case 'gemini':
      return env('GEMINI_API_KEY')
    case 'openai':
      return env('OPENAI_API_KEY')
    case 'anthropic':
      return env('ANTHROPIC_API_KEY')
    case 'groq':
      return env('GROQ_API_KEY')
    case 'openrouter':
      return env('OPENROUTER_API_KEY')
    case 'custom':
      return env('CUSTOM_AI_API_KEY')
    default:
      return ''
  }
}

export function getDefaultModelForProvider(p: AiProvider): string {
  switch (p) {
    case 'gemini':
      return env('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
    case 'openai':
      return env('OPENAI_MODEL') || 'gpt-4o-mini'
    case 'anthropic':
      return env('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022'
    case 'groq':
      return env('GROQ_MODEL') || 'llama-3.3-70b-versatile'
    case 'openrouter':
      return env('OPENROUTER_MODEL') || 'meta-llama/llama-3.3-70b-instruct'
    case 'custom':
      return env('CUSTOM_AI_MODEL') || 'default'
  }
}

/** Record usage events asynchronously without throwing */
async function recordUsage(
  userId: string | undefined,
  feature: string,
  config: ProviderConfig,
  res: { text?: string; inTok?: number; outTok?: number; duration: number; err?: string },
) {
  try {
    const { adminClient } = await import('./admin.server')
    const db = adminClient()
    const inTok = res.inTok ?? null
    const outTok = res.outTok ?? null
    const total = inTok != null && outTok != null ? inTok + outTok : null

    let cost = 0
    if (total != null) {
      if (config.provider === 'openai') cost = (total / 1000) * 0.0006
      else if (config.provider === 'anthropic') cost = (total / 1000) * 0.003
      else if (config.provider === 'gemini') cost = (total / 1000) * 0.0001
      else cost = (total / 1000) * 0.0002
    }

    await db.from('ai_usage_events').insert({
      user_id: userId || null,
      feature: feature || 'assistant',
      provider: config.provider,
      model: config.model,
      input_tokens: inTok,
      output_tokens: outTok,
      total_tokens: total,
      estimated_cost_usd: Number(cost.toFixed(6)),
      duration_ms: res.duration,
      status: res.err ? 'failed' : 'succeeded',
      error_message: res.err || null,
    })
  } catch (e) {
    console.error('[ai-usage-tracking] failed to record event:', e)
  }
}

// ---------------- Google Gemini caller ----------------
async function callGemini(
  config: ProviderConfig,
  turns: ChatTurn[],
  opts: GenerationOptions,
): Promise<{ text: string; inTok?: number; outTok?: number }> {
  const API = 'https://generativelanguage.googleapis.com/v1beta/models'
  const body = JSON.stringify(buildRequest(turns, opts))

  const res = await fetch(`${API}/${encodeURIComponent(config.model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
    body,
  })

  if (!res.ok) {
    const ra = res.headers.get('retry-after')
    throw errorFromStatus(res.status, ra)
  }

  const data = (await res.json()) as GeminiResponse
  const text = readReply(data)
  return {
    text,
    inTok: data.usageMetadata?.promptTokenCount,
    outTok: data.usageMetadata?.candidatesTokenCount,
  }
}

// ---------------- OpenAI / Groq / OpenRouter / Custom compatible implementation ----------------
async function callOpenAiCompatible(
  config: ProviderConfig,
  turns: ChatTurn[],
  opts: GenerationOptions,
): Promise<{ text: string; inTok?: number; outTok?: number }> {
  let url = config.baseUrl || 'https://api.openai.com/v1'
  if (config.provider === 'groq') url = 'https://api.groq.com/openai/v1'
  if (config.provider === 'openrouter') url = 'https://openrouter.ai/api/v1'

  const messages: any[] = turns.map((t) => ({
    role: t.role,
    content: t.content,
  }))

  if (opts.files?.length) {
    const last = messages[messages.length - 1]
    if (last && last.role === 'user') {
      const parts: any[] = [{ type: 'text', text: last.content }]
      for (const f of opts.files) {
        parts.push({
          type: 'image_url',
          image_url: { url: `data:${f.mimeType};base64,${f.data}` },
        })
      }
      last.content = parts
    }
  }

  const body: any = {
    model: config.model,
    messages,
  }
  if (opts.schema) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${url.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const ra = res.headers.get('retry-after')
    throw errorFromStatus(res.status, ra)
  }

  const data = (await res.json()) as any
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new AiError('empty', 'The AI service returned an empty reply.')

  return {
    text,
    inTok: data.usage?.prompt_tokens,
    outTok: data.usage?.completion_tokens,
  }
}

// ---------------- Anthropic Claude implementation ----------------
async function callAnthropic(
  config: ProviderConfig,
  turns: ChatTurn[],
  opts: GenerationOptions,
): Promise<{ text: string; inTok?: number; outTok?: number }> {
  const url = config.baseUrl || 'https://api.anthropic.com/v1/messages'
  const system = turns.filter((t) => t.role === 'system').map((t) => t.content).join('\n\n')
  const messages: any[] = []

  for (const t of turns) {
    if (t.role === 'system' || !t.content.trim()) continue
    messages.push({
      role: t.role === 'assistant' ? 'assistant' : 'user',
      content: t.content,
    })
  }

  if (opts.files?.length && messages.length) {
    const last = messages[messages.length - 1]
    if (last.role === 'user') {
      const contentParts: any[] = []
      for (const f of opts.files) {
        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: f.mimeType,
            data: f.data,
          },
        })
      }
      contentParts.push({ type: 'text', text: last.content })
      last.content = contentParts
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages,
    }),
  })

  if (!res.ok) {
    const ra = res.headers.get('retry-after')
    throw errorFromStatus(res.status, ra)
  }

  const data = (await res.json()) as any
  const text = (data.content ?? [])
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('')
    .trim()

  return {
    text,
    inTok: data.usage?.input_tokens,
    outTok: data.usage?.output_tokens,
  }
}

/** Executes AI generation against a specific provider */
async function executeProvider(
  cfg: ProviderConfig,
  turns: ChatTurn[],
  opts: GenerationOptions,
): Promise<{ text: string; inTok?: number; outTok?: number }> {
  if (!cfg.apiKey) {
    throw new AiError('config', `API key is not configured for provider: ${cfg.provider}`)
  }

  switch (cfg.provider) {
    case 'gemini':
      return callGemini(cfg, turns, opts)
    case 'anthropic':
      return callAnthropic(cfg, turns, opts)
    case 'openai':
    case 'groq':
    case 'openrouter':
    case 'custom':
      return callOpenAiCompatible(cfg, turns, opts)
    default:
      throw new AiError('config', `Unsupported AI provider: ${cfg.provider}`)
  }
}

/** Main generation gateway with automatic fallback support and usage analytics */
export async function generate(turns: ChatTurn[], opts: GenerationOptions = {}): Promise<string> {
  const { primary, fallback } = await getActiveAiConfig()
  const start = Date.now()

  try {
    const res = await executeProvider(primary, turns, opts)
    const duration = Date.now() - start
    await recordUsage(opts.userId, opts.feature || 'assistant', primary, {
      text: res.text,
      inTok: res.inTok,
      outTok: res.outTok,
      duration,
    })
    return res.text
  } catch (err: any) {
    const duration = Date.now() - start
    console.warn(`[ai-engine] Primary provider ${primary.provider} failed:`, err?.message || err)
    await recordUsage(opts.userId, opts.feature || 'assistant', primary, {
      duration,
      err: err?.message || 'Primary provider failure',
    })

    if (fallback && fallback.apiKey) {
      console.info(`[ai-engine] Attempting fallback provider ${fallback.provider}...`)
      const fbStart = Date.now()
      try {
        const fbRes = await executeProvider(fallback, turns, opts)
        const fbDuration = Date.now() - fbStart
        await recordUsage(opts.userId, opts.feature || 'assistant', fallback, {
          text: fbRes.text,
          inTok: fbRes.inTok,
          outTok: fbRes.outTok,
          duration: fbDuration,
        })
        return fbRes.text
      } catch (fbErr: any) {
        await recordUsage(opts.userId, opts.feature || 'assistant', fallback, {
          duration: Date.now() - fbStart,
          err: fbErr?.message || 'Fallback provider failure',
        })
        throw fbErr
      }
    }

    throw err
  }
}

/** Text completion compatibility */
export async function complete(turns: ChatTurn[], opts: GenerationOptions = {}): Promise<string> {
  return generate(turns, opts)
}

/** Parses JSON reply strictly or extracts object */
export function parseJsonReply<T>(text: string): T {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new AiError('empty', 'The AI reply did not contain valid JSON.')
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    throw new AiError('empty', 'The AI reply did not contain valid JSON.')
  }
}

/** Test connectivity to any provider with supplied credentials */
export async function testProviderConnection(cfg: ProviderConfig): Promise<{ success: boolean; reply?: string; durationMs: number; error?: string }> {
  const start = Date.now()
  try {
    const res = await executeProvider(
      cfg,
      [{ role: 'user', content: 'Respond with exactly: OK' }],
      { feature: 'system_test' },
    )
    return { success: true, reply: res.text, durationMs: Date.now() - start }
  } catch (e: any) {
    return { success: false, durationMs: Date.now() - start, error: e?.message || 'Connection failed' }
  }
}
