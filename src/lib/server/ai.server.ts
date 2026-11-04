export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type Provider = 'langflow' | 'openai'

function env(name: string) {
  return process.env[name]?.trim() || ''
}

function configured(p: Provider) {
  return p === 'langflow'
    ? Boolean(env('LANGFLOW_URL') && env('LANGFLOW_FLOW_ID'))
    : Boolean(env('OPENAI_API_KEY'))
}

async function callOpenAI(turns: ChatTurn[], json: boolean): Promise<string> {
  const base = env('OPENAI_BASE_URL') || 'https://api.openai.com/v1'
  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env('OPENAI_API_KEY')}` },
    body: JSON.stringify({
      model: env('OPENAI_MODEL') || 'gpt-4o-mini',
      messages: turns,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) throw new Error(`AI provider returned ${res.status}`)
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const text = body.choices?.[0]?.message?.content
  if (!text) throw new Error('AI provider returned an empty reply')
  return text
}

async function callLangflow(turns: ChatTurn[], sessionId: string): Promise<string> {
  // Langflow chat flows take one input string; we flatten the compact context into it.
  const input = turns.map((t) => (t.role === 'system' ? `[Context]\n${t.content}` : `[${t.role}]\n${t.content}`)).join('\n\n')
  const base = env('LANGFLOW_URL').replace(/\/$/, '')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (env('LANGFLOW_API_KEY')) headers['x-api-key'] = env('LANGFLOW_API_KEY')
  const res = await fetch(`${base}/api/v1/run/${env('LANGFLOW_FLOW_ID')}?stream=false`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input_value: input, input_type: 'chat', output_type: 'chat', session_id: sessionId }),
  })
  if (!res.ok) throw new Error(`Langflow returned ${res.status}`)
  const body = (await res.json()) as {
    outputs?: { outputs?: { results?: { message?: { text?: string } }; messages?: { message?: string }[] }[] }[]
  }
  const out = body.outputs?.[0]?.outputs?.[0]
  const text = out?.results?.message?.text ?? out?.messages?.[0]?.message
  if (!text) throw new Error('Langflow returned an empty reply')
  return text
}

/**
 * Runs a completion on the configured provider (AI_PROVIDER), falling back to the
 * other one when AI_FALLBACK=true and the primary fails or is not configured.
 */
export async function complete(turns: ChatTurn[], opts: { sessionId: string; json?: boolean }): Promise<string> {
  const primary: Provider = env('AI_PROVIDER') === 'openai' ? 'openai' : 'langflow'
  const secondary: Provider = primary === 'langflow' ? 'openai' : 'langflow'
  const order = [primary, ...(env('AI_FALLBACK') !== 'false' ? [secondary] : [])].filter(configured)
  if (order.length === 0) throw new Error('No AI provider is configured. Set Langflow or OpenAI variables in .env.')
  let lastError: unknown
  for (const p of order) {
    try {
      return p === 'openai' ? await callOpenAI(turns, Boolean(opts.json)) : await callLangflow(turns, opts.sessionId)
    } catch (e) {
      lastError = e
      console.error(`[ai] ${p} failed`, e)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI request failed')
}

/** Pulls the first JSON object out of a model reply (tolerates code fences or prose around it). */
export function parseJsonReply<T>(text: string): T {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI reply did not contain JSON')
  return JSON.parse(text.slice(start, end + 1)) as T
}
