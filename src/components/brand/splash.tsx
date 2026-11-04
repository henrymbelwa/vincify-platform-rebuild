import { LogoMark } from '@/components/brand/logo'
import { cn } from '@/lib/utils'

export function Splash({ leaving }: { leaving?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0f0c1d] text-white transition-opacity duration-500 motion-reduce:transition-none',
        leaving && 'pointer-events-none opacity-0',
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(40rem 30rem at 50% 38%, rgb(139 92 246 / 0.35), transparent 70%), radial-gradient(30rem 20rem at 62% 62%, rgb(236 72 153 / 0.22), transparent 70%)',
        }}
      />
      <div className="relative flex flex-col items-center">
        <div className="relative">
          <span
            aria-hidden="true"
            className="animate-pulse-ring absolute inset-0 rounded-full border border-brand-lilac/50"
          />
          <LogoMark size={88} className="animate-logo-in relative" />
        </div>
        <p className="animate-logo-in mt-6 text-sm font-medium tracking-[0.5em] text-white/90 [animation-delay:150ms]">
          WELCOME TO VINCIFY
        </p>
        <p className="mt-3 max-w-xs text-center text-sm text-white/60">
          Your personal AI assistant for a smarter, more organized and
          productive life.
        </p>
        <div className="mt-8 h-0.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="animate-loading-bar h-full w-1/3 rounded-full bg-brand-gradient" />
        </div>
        <span className="sr-only">Loading Vincify…</span>
      </div>
    </div>
  )
}
