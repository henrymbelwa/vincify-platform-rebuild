export function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

export function formatDue(dueInDays: number) {
  if (dueInDays === 0) return 'Today'
  if (dueInDays === 1) return 'Tomorrow'
  if (dueInDays === -1) return 'Yesterday'
  if (dueInDays < 0) return `${Math.abs(dueInDays)} days overdue`
  return `In ${dueInDays} days`
}

export function formatLongDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function greetingFor(date: Date) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
