export function toWeightedSectorShares<T extends Record<string, number | null>>(
  indexes: T,
  baseWeights: Record<keyof T, number>,
): T {
  const weighted = Object.fromEntries(
    Object.entries(indexes).map(([key, value]) => [
      key,
      value == null ? null : value * (baseWeights[key] ?? 0),
    ]),
  ) as Record<keyof T, number | null>
  const total = Object.values(weighted).reduce<number>((sum, value) => sum + (value ?? 0), 0)
  return Object.fromEntries(
    Object.entries(weighted).map(([key, value]) => [
      key,
      total > 0 && value != null ? Math.round((value / total) * 10_000) / 100 : null,
    ]),
  ) as T
}
