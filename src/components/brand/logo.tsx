import { cn } from '@/lib/utils'

const markSrc = (_w: number) =>
  `/img/vincify-mark.png`

export function LogoMark({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src={markSrc(size * 2)}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  )
}

/** Mark + wordmark. The wordmark is live text so it adapts to dark surfaces. */
export function Logo({
  size = 30,
  className,
  tone = 'dark',
}: {
  size?: number
  className?: string
  tone?: 'dark' | 'light'
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      <span
        className={cn(
          'font-semibold tracking-[0.22em]',
          tone === 'light' ? 'text-white' : 'text-foreground',
        )}
        style={{ fontSize: size * 0.56 }}
      >
        VINCIFY
      </span>
      <span className="sr-only">Vincify</span>
    </span>
  )
}
