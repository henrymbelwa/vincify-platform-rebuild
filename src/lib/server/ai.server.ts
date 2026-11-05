/**
 * Native Google Gemini client (server only). The API key is read from GEMINI_API_KEY inside each call,
 * sent only in the x-goog-api-key header, and never logged or returned to the browser.
 */

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface InlineFile {
  mimeType: string
  /** Base64-encoded bytes. */
  data: string
}

export type AiErrorCode = 'config' | 'bad_request' | 'auth' | 'model' | 'rate_limit' | 'unavailable' | 'timeout' | 'blocked' | 'empty'

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

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_TIMEOUT_MS = 45000
const API = 'https://generativelanguage.googleapis.com/v1beta/models'

function env(name: string) {
  return process.env[name]?.trim() || ''
}

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

/** Maps a non-OK provider status to a safe, user-readable error. */
export function errorFromStatus(status: number, retryAfter?: string | null): AiError {
  const ra = parseRetryAfter(retryAfter ?? null)
  if (status === 400) return new AiError('bad_request', 'The AI service could not process this request or file.', status)
  if (status === 401 || status === 403) return new AiError('auth', 'The AI service key is invalid or not authorised. Check GEMINI_API_KEY.', status)
  if (status === 404) return new AiError('model', 'The configured AI model is not available. Check GEMINI_MODEL.', status)
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

/** Runs one generateContent request with a total time budget and one bounded retry for 429/5xx. */
export async function generate(turns: ChatTurn[], opts: { files?: InlineFile[]; schema?: object } = {}): Promise<string> {
  const key = env('GEMINI_API_KEY')
  if (!key) throw new AiError('config', 'AI is not configured. Set GEMINI_API_KEY on the server.')
  const model = env('GEMINI_MODEL') || DEFAULT_MODEL
  const budget = Number(env('GEMINI_TIMEOUT_MS')) || DEFAULT_TIMEOUT_MS
  const deadline = Date.now() + budget
  const body = JSON.stringify(buildRequest(turns, opts))

  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), remaining)
    try {
      const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const err = errorFromStatus(res.status, res.headers.get('retry-after'))
        const detail = await res.text().catch(() => '')
        console.error(`[ai] gemini ${model} status ${res.status}: ${detail.slice(0, 300)}`)
        const wait = Math.min(err.retryAfterMs ?? 1500, 5000)
        if (attempt === 0 && isRetryable(err) && deadline - Date.now() > wait + 3000) {
          await new Promise((r) => setTimeout(r, wait))
          continue
        }
        throw err
      }
      return readReply((await res.json()) as GeminiResponse)
    } catch (e) {
      if (e instanceof AiError) throw e
      if (ctrl.signal.aborted) throw new AiError('timeout', 'The AI service took too long to respond. Please try again.')
      console.error(`[ai] gemini ${model} network error`, e instanceof Error ? e.message : e)
      throw new AiError('unavailable', 'Could not reach the AI service. Please try again shortly.')
    } finally {
      clearTimeout(timer)
    }
  }
  throw new AiError('timeout', 'The AI service took too long to respond. Please try again.')
}

/** Text completion used by chat. Kept for compatibility with existing callers. */
export async function complete(turns: ChatTurn[], _opts: { sessionId?: string } = {}): Promise<string> {
  return generate(turns)
}

/** Pulls the first JSON object out of a model reply (tolerates code fences or prose around it). */
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
