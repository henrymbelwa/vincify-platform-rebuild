import { useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { CalendarClock, Download, FileText, Loader2, Sparkles, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Empty, LoadingRows, PageHeader, Panel } from '@/components/app/page'
import { Markdown } from '@/components/app/markdown'
import { selectClass } from '@/components/app/new-task-dialog'
import { analyzeDocument, getAnalysisQuota } from '@/lib/api.functions'
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, resolveMime } from '@/lib/documents'
import { WEEKDAYS } from '@/lib/dates'
import { currentUserId, must, sb } from '@/lib/supabase'
import type { DocumentRow } from '@/lib/types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/documents')({
  head: () => ({ meta: [{ title: 'My Documents - Vincify' }] }),
  component: Documents,
})

interface Entry {
  title: string
  weekday: number
  start_time: string
  end_time: string
  location?: string | null
}

function Documents() {
  const qc = useQueryClient()
  const analyze = useServerFn(analyzeDocument)
  const fetchQuota = useServerFn(getAnalysisQuota)
  const quota = useQuery({ queryKey: ['analysis-quota'], queryFn: () => fetchQuota() })
  const outOfQuota = quota.data ? quota.data.remaining <= 0 : false
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [review, setReview] = useState<{ jobId: string; docId: string; name: string; entries: Entry[] } | null>(null)
  const [summary, setSummary] = useState<DocumentRow | null>(null)

  const docs = useQuery({
    queryKey: ['documents'],
    queryFn: async () => must(await sb().from('documents').select('*').order('created_at', { ascending: false })) as DocumentRow[],
  })
  const timetables = useQuery({
    queryKey: ['timetables'],
    queryFn: async () =>
      must(await sb().from('timetables').select('id,name,created_at,timetable_entries(count)').order('created_at', { ascending: false })) as {
        id: string
        name: string
        timetable_entries: { count: number }[]
      }[],
  })

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    const uid = await currentUserId()
    for (const file of Array.from(files)) {
      const type = resolveMime(file.type, file.name)
      if (!type) {
        toast.error(`${file.name}: only ${Object.values(ACCEPTED_TYPES).join(', ')} files are supported`)
        continue
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name}: files must be 20 MB or smaller`)
        continue
      }
      const path = `${uid}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_').slice(-120)}`
      const up = await sb().storage.from('documents').upload(path, file, { contentType: type, upsert: false })
      if (up.error) {
        toast.error(`${file.name}: ${up.error.message}`)
        continue
      }
      const ins = await sb().from('documents').insert({ user_id: uid, name: file.name.slice(0, 255), storage_path: path, mime_type: type, size_bytes: file.size })
      if (ins.error) {
        await sb().storage.from('documents').remove([path])
        toast.error(ins.error.message)
      } else toast.success(`${file.name} uploaded`)
    }
    setUploading(false)
    qc.invalidateQueries({ queryKey: ['documents'] })
  }

  async function run(doc: DocumentRow, kind: 'summary' | 'timetable') {
    setBusy(`${doc.id}-${kind}`)
    try {
      const res = await analyze({ data: { documentId: doc.id, kind } })
      if (kind === 'timetable') {
        const r = res.result as { name: string; entries: Entry[] }
        if (!r.entries.length) toast.info('No timetable was found in this document.')
        else setReview({ jobId: res.jobId, docId: doc.id, name: r.name || doc.name, entries: r.entries })
      } else {
        const fresh = must(await sb().from('documents').select('*').eq('id', doc.id).single()) as DocumentRow
        setSummary(fresh)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setBusy(null)
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['analysis-quota'] })
    }
  }

  async function confirmTimetable() {
    if (!review) return
    const uid = await currentUserId()
    const valid = review.entries.filter((e) => e.title.trim() && e.start_time && e.end_time)
    try {
      const tt = must(await sb().from('timetables').insert({ user_id: uid, document_id: review.docId, name: review.name.slice(0, 160) }).select('id').single()) as { id: string }
      must(
        await sb()
          .from('timetable_entries')
          .insert(valid.map((e) => ({ user_id: uid, timetable_id: tt.id, title: e.title.slice(0, 200), weekday: e.weekday, start_time: e.start_time, end_time: e.end_time, location: e.location || null }))),
      )
      await sb().from('document_processing').update({ status: 'confirmed' }).eq('id', review.jobId)
      toast.success(`${valid.length} timetable entries added to your calendar`)
      setReview(null)
      qc.invalidateQueries({ queryKey: ['timetables'] })
      qc.invalidateQueries({ queryKey: ['timetable_entries'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save timetable')
    }
  }

  async function download(doc: DocumentRow) {
    const { data, error } = await sb().storage.from('documents').createSignedUrl(doc.storage_path, 60)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function remove(doc: DocumentRow) {
    if (!confirm(`Delete ${doc.name}?`)) return
    await sb().storage.from('documents').remove([doc.storage_path])
    const { error } = await sb().from('documents').delete().eq('id', doc.id)
    if (error) return toast.error(error.message)
    qc.invalidateQueries({ queryKey: ['documents'] })
  }

  const setEntry = (i: number, patch: Partial<Entry>) => setReview((r) => r && { ...r, entries: r.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) })

  return (
    <div className="mx-auto max-w-content space-y-6">
      <PageHeader title="My Documents" description="Private storage with AI summaries and timetable extraction you review before saving." />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          upload(e.dataTransfer.files)
        }}
        className={cn('flex w-full flex-col items-center rounded-2xl border-2 border-dashed bg-card px-6 py-10 text-center transition-colors', drag ? 'border-primary bg-accent' : 'hover:border-primary/40')}
      >
        {uploading ? <Loader2 className="size-6 animate-spin text-primary" /> : <Upload className="size-6 text-primary" />}
        <span className="mt-3 text-sm font-medium">{uploading ? 'Uploading' : 'Drop files here or click to upload'}</span>
        <span className="mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT, JPG, PNG or WEBP, up to 20 MB</span>
      </button>
      {quota.data && (
        <p className={cn('text-xs', outOfQuota ? 'text-destructive' : 'text-muted-foreground')} aria-live="polite">
          {outOfQuota
            ? `You have used all ${quota.data.limit} document analyses for today. Your allowance resets at midnight Tanzania time.`
            : `${quota.data.remaining} of ${quota.data.limit} analyses remaining today`}
        </p>
      )}
      <input ref={input} type="file" multiple hidden accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp" onChange={(e) => upload(e.target.files)} />

      <Panel title="Documents">
        {docs.isLoading ? (
          <LoadingRows />
        ) : !docs.data?.length ? (
          <Empty icon={FileText} title="No documents yet" />
        ) : (
          <ul className="divide-y">
            {docs.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(d.size_bytes / 1024 / 1024).toFixed(2)} MB, {new Date(d.created_at).toLocaleDateString()}
                    {d.status === 'failed' && <span className="text-destructive"> , last analysis failed</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="xs" variant="outline" disabled={Boolean(busy)} onClick={() => (d.summary ? setSummary(d) : run(d, 'summary'))}>
                    {busy === `${d.id}-summary` ? <Loader2 className="animate-spin" /> : <Sparkles />} {d.summary ? 'Summary' : 'Summarise'}
                  </Button>
                  <Button size="xs" variant="outline" disabled={Boolean(busy)} onClick={() => run(d, 'timetable')}>
                    {busy === `${d.id}-timetable` ? <Loader2 className="animate-spin" /> : <CalendarClock />} Extract timetable
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Download ${d.name}`} onClick={() => download(d)}>
                    <Download />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => remove(d)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Timetables">
        {!timetables.data?.length ? (
          <p className="text-sm text-muted-foreground">Extract a timetable from a document to populate your calendar automatically.</p>
        ) : (
          <ul className="divide-y">
            {timetables.data.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 text-sm">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.timetable_entries[0]?.count ?? 0} entries</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Delete ${t.name}`}
                  onClick={async () => {
                    if (!confirm('Remove this timetable from your calendar?')) return
                    await sb().from('timetables').delete().eq('id', t.id)
                    qc.invalidateQueries({ queryKey: ['timetables'] })
                    qc.invalidateQueries({ queryKey: ['timetable_entries'] })
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={Boolean(summary)} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{summary?.name}</DialogTitle>
            <DialogDescription>AI summary generated from the document text.</DialogDescription>
          </DialogHeader>
          {summary?.summary && <Markdown content={summary.summary} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => summary && run(summary, 'summary')}>
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(review)} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review extracted timetable</DialogTitle>
            <DialogDescription>Check and correct each entry. Nothing is saved until you confirm.</DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-3">
              <Input value={review.name} onChange={(e) => setReview({ ...review, name: e.target.value })} aria-label="Timetable name" />
              {review.entries.map((e, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_8rem_6rem_6rem_1fr_auto]">
                  <Input value={e.title} onChange={(ev) => setEntry(i, { title: ev.target.value })} aria-label="Title" className="col-span-2 sm:col-span-1" />
                  <select value={e.weekday} onChange={(ev) => setEntry(i, { weekday: Number(ev.target.value) })} className={selectClass} aria-label="Day">
                    {WEEKDAYS.map((d, n) => (
                      <option key={d} value={n}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <Input type="time" value={e.start_time.slice(0, 5).padStart(5, '0')} onChange={(ev) => setEntry(i, { start_time: ev.target.value })} aria-label="Start" />
                  <Input type="time" value={e.end_time.slice(0, 5).padStart(5, '0')} onChange={(ev) => setEntry(i, { end_time: ev.target.value })} aria-label="End" />
                  <Input value={e.location ?? ''} onChange={(ev) => setEntry(i, { location: ev.target.value })} placeholder="Location" aria-label="Location" />
                  <Button size="icon-sm" variant="ghost" aria-label="Remove entry" onClick={() => setReview({ ...review, entries: review.entries.filter((_, j) => j !== i) })}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={async () => {
                if (review) await sb().from('document_processing').update({ status: 'discarded' }).eq('id', review.jobId)
                setReview(null)
              }}
            >
              Discard
            </Button>
            <Button variant="brand" onClick={confirmTimetable} disabled={!review?.entries.length}>
              Confirm and add to calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
