import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-muted-foreground">
          This page doesn’t exist. Check the address or return to the home page.
        </p>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </main>
  )
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  // Always log the real error so failures are never opaque.
  console.error('[route-error]', error)

  const detail = error instanceof Error ? error.message : String(error)

  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          This page couldn’t load
        </h1>
        <p role="alert" className="text-muted-foreground">
          Please try again, or return to the home page.
        </p>
        {import.meta.env.DEV && detail && (
          <p className="rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs break-words text-muted-foreground">
            {detail}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              void router.invalidate()
              reset()
              // A clean reload refetches any interrupted module chunks.
              window.location.reload()
            }}
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Go home</a>
          </Button>
        </div>
      </div>
    </main>
  )
}
