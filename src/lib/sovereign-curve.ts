/**
 * Cross-sectional sovereign-curve helpers.
 *
 * A residual is measured against the fitted curve for the same governing law.
 * Positive residuals mean a higher YTM than the curve at the same duration
 * ("barato" in yield terms); negative residuals mean "caro".
 */

export type SovereignLaw = "NY" | "local"

export interface SovereignCurveInput {
  ticker: string
  law: SovereignLaw
  duration: number
  ytm: number
}

export type CurveValuation = "barato" | "caro" | "en_curva" | "sin_referencia"

export interface SovereignCurvePoint extends SovereignCurveInput {
  fittedYtm: number | null
  residualBps: number | null
  valuation: CurveValuation
}

const MIN_REFERENCE_POINTS = 3
const IN_CURVE_THRESHOLD_BPS = 5

function fitLinearCurve(points: SovereignCurveInput[]): { intercept: number; slope: number } | null {
  if (points.length < MIN_REFERENCE_POINTS) return null

  const meanDuration = points.reduce((sum, point) => sum + point.duration, 0) / points.length
  const meanYtm = points.reduce((sum, point) => sum + point.ytm, 0) / points.length
  const variance = points.reduce((sum, point) => sum + (point.duration - meanDuration) ** 2, 0)

  if (variance === 0) return null

  const covariance = points.reduce(
    (sum, point) => sum + (point.duration - meanDuration) * (point.ytm - meanYtm),
    0,
  )
  const slope = covariance / variance

  return { intercept: meanYtm - slope * meanDuration, slope }
}

/**
 * Fits independent least-squares curves for local-law and New-York-law bonds.
 * A law needs at least three non-degenerate observations before residuals are
 * exposed, avoiding a misleading comparison from a two-point line.
 */
export function buildSovereignCurve(inputs: SovereignCurveInput[]): SovereignCurvePoint[] {
  const valid = inputs.filter(
    (point) => Number.isFinite(point.duration) && Number.isFinite(point.ytm),
  )
  const fits = new Map<SovereignLaw, { intercept: number; slope: number } | null>([
    ["NY", fitLinearCurve(valid.filter((point) => point.law === "NY"))],
    ["local", fitLinearCurve(valid.filter((point) => point.law === "local"))],
  ])

  return valid
    .map((point) => {
      const fit = fits.get(point.law)
      if (!fit) {
        return { ...point, fittedYtm: null, residualBps: null, valuation: "sin_referencia" as const }
      }

      const fittedYtm = fit.intercept + fit.slope * point.duration
      const residualBps = (point.ytm - fittedYtm) * 100
      const valuation: CurveValuation = residualBps > IN_CURVE_THRESHOLD_BPS
        ? "barato"
        : residualBps < -IN_CURVE_THRESHOLD_BPS
          ? "caro"
          : "en_curva"

      return { ...point, fittedYtm, residualBps, valuation }
    })
    .sort((a, b) => a.duration - b.duration)
}
