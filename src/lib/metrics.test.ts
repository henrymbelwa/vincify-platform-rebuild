import { describe, expect, it } from 'vitest'
import { isOverdue, streak, taskStats } from './metrics'

const now = new Date('2026-11-04T12:00:00Z')

describe('taskStats', () => {
  it('excludes cancelled tasks from the completion rate', () => {
    const s = taskStats(
      [
        { status: 'completed', due_at: null },
        { status: 'not_started', due_at: null },
        { status: 'cancelled', due_at: null },
        { status: 'cancelled', due_at: null },
      ],
      now,
    )
    expect(s.eligible).toBe(2)
    expect(s.completionRate).toBe(50)
  })

  it('returns null rate when nothing is eligible', () => {
    expect(taskStats([{ status: 'cancelled', due_at: null }], now).completionRate).toBeNull()
  })
})

describe('isOverdue', () => {
  it('flags open tasks past due but not completed or cancelled ones', () => {
    expect(isOverdue({ status: 'in_progress', due_at: '2026-11-03T00:00:00Z' }, now)).toBe(true)
    expect(isOverdue({ status: 'completed', due_at: '2026-11-03T00:00:00Z' }, now)).toBe(false)
    expect(isOverdue({ status: 'cancelled', due_at: '2026-11-03T00:00:00Z' }, now)).toBe(false)
  })
})

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak(new Set(['2026-11-04', '2026-11-03', '2026-11-01']), '2026-11-04')).toBe(2)
  })
})
