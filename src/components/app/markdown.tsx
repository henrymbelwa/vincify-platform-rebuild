import { Fragment } from 'react'

/** Minimal, safe markdown for chat previews: paragraphs, bullets, **bold**, `code`, ``` blocks. */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{p.slice(1, -1)}</code>
    return <Fragment key={i}>{p}</Fragment>
  })
}

export function Markdown({ content }: { content: string }) {
  const blocks = content.split(/```/)
  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {blocks.map((block, bi) =>
        bi % 2 === 1 ? (
          <pre key={bi} className="overflow-x-auto rounded-lg bg-ink p-3 text-xs text-ink-foreground/90">
            <code>{block.replace(/^\w*\n/, '')}</code>
          </pre>
        ) : (
          block
            .trim()
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, pi) => {
              const lines = para.split('\n')
              const bullets = lines.filter((l) => /^[-*] /.test(l))
              const head = lines.filter((l) => !/^[-*] /.test(l))
              return (
                <div key={`${bi}-${pi}`}>
                  {head.map((l, li) => (
                    <p key={li}>{inline(l)}</p>
                  ))}
                  {bullets.length > 0 && (
                    <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-brand-lilac">
                      {bullets.map((l, li) => (
                        <li key={li}>{inline(l.slice(2))}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })
        ),
      )}
    </div>
  )
}
