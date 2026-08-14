export function recentObservedValues(
  rows: readonly Record<string, unknown>[],
  key: string,
  limit: number,
): number[] {
  if (limit <= 0) return []
  const values: number[] = []

  for (let index = rows.length - 1; index >= 0 && values.length < limit; index -= 1) {
    const value = rows[index]?.[key]
    if (typeof value === "number" && Number.isFinite(value)) values.push(value)
  }

  return values
}
