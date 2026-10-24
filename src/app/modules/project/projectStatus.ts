export type ProjectLifecycleStatus = 'pending' | 'in-progress' | 'completed'

const STORED_STATUSES = new Set<string>(['pending', 'in-progress', 'completed'])

const asDate = (value?: Date | string | null): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Status shown for a project. Missing dates keep the stored value so the
 * row does not move tabs. The result is not written back.
 */
export const projectStatusForDates = (
  startDate?: Date | string | null,
  endDate?: Date | string | null,
  now: Date = new Date(),
  stored?: string | null,
): string => {
  const start = asDate(startDate)
  const end = asDate(endDate)
  if (!start || !end) {
    if (stored && STORED_STATUSES.has(stored)) return stored
    return 'pending'
  }
  if (now < start) return 'pending'
  if (now > end) return 'completed'
  return 'in-progress'
}

/** Mongo condition matching projectStatusForDates. Unknown values are ignored. */
export const statusFilterForDates = (
  status: string,
  now: Date = new Date(),
): Record<string, unknown> | null => {
  if (status === 'pending') return { startDate: { $gt: now } }
  if (status === 'in-progress') {
    return { startDate: { $lte: now }, endDate: { $gte: now } }
  }
  if (status === 'completed') return { endDate: { $lt: now } }
  return null
}
