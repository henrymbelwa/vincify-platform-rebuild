import { describe, expect, it } from 'vitest'
import { buildRequest, errorFromStatus, readReply } from '@/lib/server/ai.server'
import { dailyLimit, nextQuotaReset, pdfStrategy, quotaDay, resolveMime } from '@/lib/documents'

describe('Gemini request', () => {
  it('moves system turns to systemInstruction and maps assistant to model', () => {
    const r = buildRequest([{ role: 'system', content: 'S' }, { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }])
    expect(r.systemInstruction?.parts[0]?.text).toBe('S')
    expect(r.contents.map((c) => c.role)).toEqual(['user', 'model', 'user'])
  })
  it('merges consecutive same-role turns', () => {
    const r = buildRequest([{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }])
    expect(r.contents).toHaveLength(1)
    expect((r.contents[0]!.parts[0] as { text: string }).text).toBe('a\n\nb')
  })
  it('always ends on a user turn', () => {
    const r = buildRequest([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }])
    expect(r.contents.at(-1)!.role).toBe('user')
    expect(r.contents).toHaveLength(3)
  })
})

describe('Gemini errors', () => {
  it('maps statuses', () => {
    expect(errorFromStatus(400).code).toBe('bad_request')
    expect(errorFromStatus(403).code).toBe('auth')
    expect(errorFromStatus(404).code).toBe('model')
    expect(errorFromStatus(429, '7').retryAfterMs).toBe(7000)
    expect(errorFromStatus(503).code).toBe('unavailable')
  })
  it('rejects blocked and empty replies', () => {
    expect(() => readReply({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(/safety/)
    expect(() => readReply({ candidates: [{ content: { parts: [{ text: ' ' }] } }] })).toThrow(/empty/)
  })
})

describe('documents', () => {
  it('sends PDFs up to 14 MB natively, larger scanned PDFs cannot be processed', () => {
    expect(pdfStrategy(5e6, null)).toBe('native')
    expect(pdfStrategy(18e6, 5000)).toBe('text')
    expect(pdfStrategy(18e6, 50)).toBe('too_large')
  })
  it('accepts images by extension', () => {
    expect(resolveMime('', 'photo.JPEG')).toBe('image/jpeg')
    expect(resolveMime('', 'a.exe')).toBe('')
  })
  it('defaults to 3 analyses per day', () => {
    expect(dailyLimit(undefined)).toBe(3)
    expect(dailyLimit('5')).toBe(5)
  })
  it('resets at Tanzania midnight (21:00 UTC)', () => {
    expect(quotaDay(new Date('2026-11-06T20:59:00Z'))).toBe('2026-11-06')
    expect(quotaDay(new Date('2026-11-06T21:00:00Z'))).toBe('2026-11-07')
    expect(nextQuotaReset(new Date('2026-11-06T14:00:00Z'))).toBe('2026-11-06T21:00:00.000Z')
  })
})
