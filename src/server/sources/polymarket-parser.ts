export function parseVolumeString(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const direct = Number(value)
  if (Number.isFinite(direct)) return direct
  const match = value.match(/\$?([\d.]+)([KMB]?)/)
  if (!match) return 0
  const number = Number.parseFloat(match[1])
  const multiplier: Record<string, number> = { K: 1000, M: 1_000_000, B: 1_000_000_000 }
  return number * (multiplier[match[2]] || 1)
}

export function parseFirstProbability(value: string | Array<string | number> | undefined): number {
  let outcomes: Array<string | number> = []
  if (Array.isArray(value)) outcomes = value
  else if (value) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) outcomes = parsed
    } catch {
      return 50
    }
  }
  const first = Number(outcomes[0])
  return Number.isFinite(first) ? Math.round(first * 100) : 50
}
