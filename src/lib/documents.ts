/** Shared, browser-safe rules for document types, native AI file handling and the daily analysis allowance. */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
/** Largest file sent inline to Gemini (base64 adds about a third; the inline request cap is 20 MB). */
export const MAX_INLINE_BYTES = 14 * 1024 * 1024
/** Below this many extracted characters a PDF is treated as scanned (image-only). */
export const SCANNED_TEXT_THRESHOLD = 200

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  [DOCX_MIME]: 'DOCX',
  'text/plain': 'TXT',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
}

const BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: DOCX_MIME,
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Resolves a supported MIME type from the browser type or file extension, or '' when unsupported. */
export function resolveMime(type: string, name: string): string {
  if (ACCEPTED_TYPES[type]) return type
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return BY_EXT[ext] ?? ''
}

export const isImage = (mime: string) => (IMAGE_MIMES as readonly string[]).includes(mime)

export type PdfStrategy = 'native' | 'text' | 'too_large'

/**
 * PDFs go to Gemini natively whenever they fit inline so charts, tables, layouts and scanned pages are read.
 * Larger PDFs fall back to extracted text, unless they are scanned (too little text), which cannot be processed.
 */
export function pdfStrategy(sizeBytes: number, extractedChars: number | null): PdfStrategy {
  if (sizeBytes <= MAX_INLINE_BYTES) return 'native'
  if (extractedChars != null && extractedChars >= SCANNED_TEXT_THRESHOLD) return 'text'
  return 'too_large'
}

export const QUOTA_TIMEZONE = 'Africa/Dar_es_Salaam'
const TZ_OFFSET_MS = 3 * 3600 * 1000 // Tanzania is UTC+3 with no daylight saving.

/** The Tanzania-local calendar day (YYYY-MM-DD) used to bucket analysis usage. */
export function quotaDay(now: Date = new Date()): string {
  return new Date(now.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10)
}

/** The next Tanzania-local midnight, as an ISO timestamp. */
export function nextQuotaReset(now: Date = new Date()): string {
  const local = new Date(now.getTime() + TZ_OFFSET_MS)
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1)
  return new Date(midnightLocal - TZ_OFFSET_MS).toISOString()
}

export function dailyLimit(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : 3
}
