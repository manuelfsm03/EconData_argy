/**
 * Returns today's date at midnight UTC.
 * All date storage should use UTC midnight to avoid timezone-based duplicates.
 */
export function todayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

/**
 * Normalizes a date string or Date to midnight UTC.
 */
export function toMidnightUTC(input: string | Date): Date {
  const d = typeof input === 'string' ? new Date(input) : input
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}
