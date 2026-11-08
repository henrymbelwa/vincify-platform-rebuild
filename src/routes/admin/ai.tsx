import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Cpu, KeyRound, Loader2, RefreshCw, Server, ShieldCheck, Zap } from 'lucide-react'
import { PageHeader, Panel } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAdminAiConfig, testAdminAiProvider, updateAdminAiConfig } from '@/lib/admin.functions'
import { selectClass } from '@/components/app/new-task-dialog'

export const Route = createFileRoute('/admin/ai')({
  head: () => ({ meta: [{ title: 'AI Control Centre - Vincify Admin' }] }),
  component: AdminAiControlPage,
})

const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini (Native REST)', defaultModel: 'gemini-3.5-flash-lite' },
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-3-5-sonnet-20241022' },
  { id: 'groq', name: 'Groq (Ultra-low latency)', defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'openrouter', name: 'OpenRouter Aggregator', defaultModel: 'meta-llama/llama-3.3-70b-instruct' },
  { id: 'custom', name: 'Custom OpenAI-Compatible API', defaultModel: 'default' },
]

function AdminAiControlPage() {
  const queryClient = useQueryClient()
  const config = useQuery({
    queryKey: ['admin_ai_config'],
    queryFn: () => getAdminAiConfig(),
  })

  const [provider, setProvider] = useState('gemini')
  const [model, setModel] = useState('gemini-3.5-flash-lite')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [fallbackProvider, setFallbackProvider] = useState<string>('')
  const [fallbackEnabled, setFallbackEnabled] = useState(false)
  const [timeoutMs, setTimeoutMs] = useState(45000)
  const [dailyLimit, setDailyLimit] = useState(3)
  const [testResult, setTestResult] = useState<{ success?: boolean; durationMs?: number; error?: string } | null>(null)

  useEffect(() => {
    if (config.data) {
      setProvider(config.data.activeProvider)
      setModel(config.data.modelName)
      setBaseUrl(config.data.apiBaseUrl || '')
      setFallbackProvider(config.data.fallbackProvider || '')
      setFallbackEnabled(config.data.fallbackEnabled)
      setTimeoutMs(config.data.timeoutMs)
      setDailyLimit(config.data.dailyAnalysisLimit)
    }
  }, [config.data])

  const saveMutation = useMutation({
    mutationFn: (data: any) => updateAdminAiConfig({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_ai_config'] })
      setApiKey('')
      toast.success('AI configuration saved and activated')
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update AI settings'),
  })

  const testMutation = useMutation({
    mutationFn: (data: any) => testAdminAiProvider({ data }),
    onSuccess: (res) => {
      setTestResult(res)
      if (res.success) toast.success(`Provider replied successfully in ${res.durationMs}ms`)
      else toast.error(`Connection failed: ${res.error}`)
    },
    onError: (e: any) => {
      setTestResult({ success: false, error: e.message })
      toast.error(e.message || 'Test invocation failed')
    },
  })

  const handleProviderChange = (newP: string) => {
    setProvider(newP)
    const def = PROVIDERS.find((p) => p.id === newP)?.defaultModel || 'default'
    setModel(def)
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        title="AI Control Centre"
        description="Dynamic provider switching, model controls, encrypted credential vault, and connectivity verification."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Panel title="Active Provider & Model Architecture" description="Changes take effect immediately across all users without rebuilds.">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate({
                  activeProvider: provider,
                  modelName: model,
                  apiKey: apiKey || undefined,
                  apiBaseUrl: baseUrl || undefined,
                  fallbackProvider: fallbackProvider || null,
                  fallbackEnabled,
                  timeoutMs,
                  dailyAnalysisLimit: dailyLimit,
                })
              }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor="provider">Primary AI Provider</Label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className={selectClass}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="model">Model Identifier</Label>
                <Input
                  id="model"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gemini-3.5-flash-lite, gpt-4o-mini"
                />
              </div>

              {(provider === 'custom' || provider === 'openrouter' || provider === 'groq') && (
                <div className="space-y-1.5">
                  <Label htmlFor="base-url">API Base URL (Optional)</Label>
                  <Input
                    id="base-url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key">Provider API Secret Key</Label>
                  {config.data?.hasCustomKey && (
                    <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                      <ShieldCheck className="size-3" /> Encrypted Key Stored
                    </span>
                  )}
                </div>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config.data?.hasCustomKey ? '•••••••••••••••••••• (Leave blank to keep existing)' : 'Enter API Key'}
                />
                <p className="text-[11px] text-muted-foreground">
                  Credentials are encrypted with AES-256-GCM before database persistence and never returned to the browser.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={5000}
                    max={120000}
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quota">Daily Document Analyses Allowed</Label>
                  <Input
                    id="quota"
                    type="number"
                    min={1}
                    max={50}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fb-toggle"
                    checked={fallbackEnabled}
                    onChange={(e) => setFallbackEnabled(e.target.checked)}
                    className="size-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
                  />
                  <Label htmlFor="fb-toggle" className="cursor-pointer font-medium">
                    Enable Automatic Fallback Provider
                  </Label>
                </div>

                {fallbackEnabled && (
                  <div className="space-y-1.5 pl-6">
                    <Label htmlFor="fb-provider">Fallback Provider</Label>
                    <select
                      id="fb-provider"
                      value={fallbackProvider}
                      onChange={(e) => setFallbackProvider(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select fallback provider</option>
                      {PROVIDERS.filter((p) => p.id !== provider).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    testMutation.mutate({
                      provider,
                      model,
                      apiKey: apiKey || undefined,
                      baseUrl: baseUrl || undefined,
                    })
                  }
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Zap className="size-4 mr-1.5" />}
                  Test Connectivity
                </Button>

                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="size-4 mr-1.5 animate-spin" />}
                  Save Configuration
                </Button>
              </div>
            </form>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Connectivity Diagnostics" description="Real-time test ping results">
            {testResult ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Status:</span>
                  <span className={testResult.success ? 'font-semibold text-emerald-500' : 'font-semibold text-rose-500'}>
                    {testResult.success ? 'Connection Verified' : 'Failed'}
                  </span>
                </div>
                {testResult.durationMs != null && (
                  <div className="flex items-center justify-between">
                    <span>Latency:</span>
                    <span className="font-mono text-xs">{testResult.durationMs}ms</span>
                  </div>
                )}
                {testResult.error && (
                  <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                    {testResult.error}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Click 'Test Connectivity' to verify current provider credentials and model latency.
              </p>
            )}
          </Panel>

          <Panel title="Provider Status Matrix" description="Configured system fallbacks">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b">
                <span>Google Gemini</span>
                <span className="text-emerald-500 font-medium">Ready</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b">
                <span>OpenAI</span>
                <span className="text-muted-foreground">Configurable</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b">
                <span>Anthropic Claude</span>
                <span className="text-muted-foreground">Configurable</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b">
                <span>Groq</span>
                <span className="text-muted-foreground">Configurable</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Custom Endpoint</span>
                <span className="text-muted-foreground">Configurable</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
