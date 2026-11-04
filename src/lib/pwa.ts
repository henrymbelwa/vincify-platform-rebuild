/** The only place the service worker is registered. Never registers in dev, iframes or Lovable previews. */
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/
const PREVIEW_ROOTS = ['.lovable.app', '.gpt-eng.com', '.gptengineer.run']

function refused(): boolean {
  if (!import.meta.env.PROD) return true
  if (window.self !== window.top) return true
  const host = window.location.hostname.toLowerCase()
  const label = host.split('.')[0] ?? ''
  if (PREVIEW_ROOTS.some((r) => host.endsWith(r)) && (PREVIEW_LABEL.test(label) || /^project--.+-dev$/.test(label))) return true
  if (['lovableproject.com', 'lovableproject-dev.com', 'beta.lovable.dev'].some((d) => host === d || host.endsWith(`.${d}`))) return true
  if (new URLSearchParams(window.location.search).get('sw') === 'off') return true
  return false
}

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (refused()) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith('/sw.js')).map((r) => r.unregister()))
    return
  }
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (e) {
    console.warn('Service worker registration failed', e)
  }
}
