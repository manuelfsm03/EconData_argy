// ── Motor del simulador de escenarios cambiarios ─────────────────────────────
// Simulación DIDÁCTICA — no es asesoramiento financiero.
// Las fórmulas son simplificadas y usan supuestos declarados.
// ─────────────────────────────────────────────────────────────────────────────

export type InstrumentoTipo =
  | "PF_TRADICIONAL"
  | "PF_UVA"
  | "LECAP"
  | "BONO_DOLLAR_LINKED"
  | "BONO_CER"
  | "DOLAR_MEP"
  | "EFECTIVO_PESOS"

export interface Posicion {
  id: string
  tipo: InstrumentoTipo
  nombre: string
  monto: number // ARS iniciales
}

export interface Escenario {
  // Variación % del dólar durante todo el horizonte (ej. 20 = +20 %).
  dolarVariacionPct: number
  // Inflación mensual (MoM) en % (ej. 5 = 5 % mensual).
  inflacionMensualPct: number
  // Tasa BCRA (TPM) en TNA % (ej. 35 = 35 % anual).
  tpmTnaPct: number
  // Horizonte en meses (1, 3, 6, 12).
  horizonteMeses: number
  // Dólar inicial (para pasar ARS → USD).
  dolarInicialArs: number
}

export interface ResultadoPosicion {
  id: string
  nombre: string
  tipo: InstrumentoTipo
  valorInicialArs: number
  valorFinalArs: number
  valorFinalUsd: number
  retornoNominalPct: number
  retornoRealPct: number // real = descontando inflación acumulada
  retornoUsdPct: number
  formula: string
}

export interface ResultadoEscenario {
  posiciones: ResultadoPosicion[]
  ranking: ResultadoPosicion[] // ordenadas de mayor a menor por retorno real
  ganador: ResultadoPosicion | null
  dolarFinalArs: number
  inflacionAcumuladaPct: number
  totalInicialArs: number
  totalFinalArs: number
  totalFinalUsd: number
  totalRetornoRealPct: number
}

// ── Supuestos declarados ─────────────────────────────────────────────────────
// Estos "spreads" son simplificaciones didácticas.
export const SUPUESTOS = {
  // Plazo fijo tradicional: paga TAMAR ≈ TPM + spread_pf (positivo pequeño).
  spreadPfTnaPct: 5,
  // Plazo fijo UVA: paga inflación + 1 % anual (TNA).
  spreadUvaTnaPct: 1,
  // LECAP: TEM implícita ≈ (TPM / 12) * factor_lecap.
  factorLecap: 1.02,
  // Bono dollar-linked: TIR nominal en ARS (simplificado) ≈ inflación / 2.
  tirDollarLinkedTnaPct: 6,
  // Bono CER: rinde inflación + spread_real (~5 % anual histórico).
  spreadCerTnaPct: 5,
} as const

// ── Helpers matemáticos ──────────────────────────────────────────────────────
function tnaAMensual(tnaPct: number): number {
  // Convierte TNA (%) a tasa mensual efectiva simple: TNA/12 (simplificado).
  return tnaPct / 100 / 12
}

function inflacionAcumulada(inflMensualPct: number, meses: number): number {
  // (1 + i)^n - 1
  return Math.pow(1 + inflMensualPct / 100, meses) - 1
}

// ── Fórmulas por instrumento ─────────────────────────────────────────────────
function calcularPosicion(pos: Posicion, esc: Escenario): ResultadoPosicion {
  const meses = esc.horizonteMeses
  const inflAcum = inflacionAcumulada(esc.inflacionMensualPct, meses)
  const dolarFactor = 1 + esc.dolarVariacionPct / 100
  const dolarFinal = esc.dolarInicialArs * dolarFactor

  let valorFinalArs: number
  let formula: string

  switch (pos.tipo) {
    case "PF_TRADICIONAL": {
      // capital * (1 + tna/12)^meses ; tna = TPM + spread
      const tna = esc.tpmTnaPct + SUPUESTOS.spreadPfTnaPct
      const tm = tnaAMensual(tna)
      valorFinalArs = pos.monto * Math.pow(1 + tm, meses)
      formula = `capital × (1 + ${(tna).toFixed(1)}%/12)^${meses}`
      break
    }
    case "PF_UVA": {
      // capital * (1 + infl_mensual)^meses * (1 + 1%/12)^meses
      const spread = SUPUESTOS.spreadUvaTnaPct / 100 / 12
      const inflFactor = Math.pow(1 + esc.inflacionMensualPct / 100, meses)
      const spreadFactor = Math.pow(1 + spread, meses)
      valorFinalArs = pos.monto * inflFactor * spreadFactor
      formula = `capital × (1 + IPC_mensual)^${meses} × (1 + 1%/12)^${meses}`
      break
    }
    case "LECAP": {
      // capital * (1 + tem)^meses ; tem ≈ (TPM / 12) * factor
      const tem = (esc.tpmTnaPct / 100 / 12) * SUPUESTOS.factorLecap
      valorFinalArs = pos.monto * Math.pow(1 + tem, meses)
      formula = `capital × (1 + TEM)^${meses}, TEM ≈ TPM/12 × ${SUPUESTOS.factorLecap}`
      break
    }
    case "BONO_DOLLAR_LINKED": {
      // capital * (1 + dolar_var) * (1 + tir/12)^meses
      const tir = SUPUESTOS.tirDollarLinkedTnaPct
      const tm = tnaAMensual(tir)
      valorFinalArs = pos.monto * dolarFactor * Math.pow(1 + tm, meses)
      formula = `capital × (1 + Δdólar) × (1 + ${tir}%/12)^${meses}`
      break
    }
    case "BONO_CER": {
      // capital * (1 + infl_mensual)^meses * (1 + spread_real/12)^meses
      const inflFactor = Math.pow(1 + esc.inflacionMensualPct / 100, meses)
      const tm = tnaAMensual(SUPUESTOS.spreadCerTnaPct)
      valorFinalArs = pos.monto * inflFactor * Math.pow(1 + tm, meses)
      formula = `capital × (1 + IPC_mensual)^${meses} × (1 + ${SUPUESTOS.spreadCerTnaPct}%/12)^${meses}`
      break
    }
    case "DOLAR_MEP": {
      // capital * (1 + dolar_var)
      valorFinalArs = pos.monto * dolarFactor
      formula = `capital × (1 + Δdólar)`
      break
    }
    case "EFECTIVO_PESOS": {
      valorFinalArs = pos.monto
      formula = `capital (constante, sin ajuste)`
      break
    }
    default:
      valorFinalArs = pos.monto
      formula = "sin fórmula"
  }

  const valorFinalUsd = valorFinalArs / dolarFinal
  const retornoNominalPct = (valorFinalArs / pos.monto - 1) * 100
  // Retorno real: (1 + nominal) / (1 + inflacion) - 1
  const retornoReal = (1 + retornoNominalPct / 100) / (1 + inflAcum) - 1
  const retornoRealPct = retornoReal * 100
  // Retorno USD: valor final USD vs valor inicial en USD (usando dólar inicial)
  const valorInicialUsd = pos.monto / esc.dolarInicialArs
  const retornoUsdPct = (valorFinalUsd / valorInicialUsd - 1) * 100

  return {
    id: pos.id,
    nombre: pos.nombre,
    tipo: pos.tipo,
    valorInicialArs: pos.monto,
    valorFinalArs,
    valorFinalUsd,
    retornoNominalPct,
    retornoRealPct,
    retornoUsdPct,
    formula,
  }
}

// ── API pública del motor ────────────────────────────────────────────────────
export function simular(posiciones: Posicion[], esc: Escenario): ResultadoEscenario {
  const resultados = posiciones.map(p => calcularPosicion(p, esc))
  const ranking = [...resultados].sort((a, b) => b.retornoRealPct - a.retornoRealPct)

  const dolarFinalArs = esc.dolarInicialArs * (1 + esc.dolarVariacionPct / 100)
  const inflAcum = inflacionAcumulada(esc.inflacionMensualPct, esc.horizonteMeses) * 100

  const totalInicialArs = resultados.reduce((sum, r) => sum + r.valorInicialArs, 0)
  const totalFinalArs = resultados.reduce((sum, r) => sum + r.valorFinalArs, 0)
  const totalFinalUsd = totalFinalArs / dolarFinalArs
  const totalRetornoNominal = totalInicialArs > 0 ? totalFinalArs / totalInicialArs - 1 : 0
  const totalRetornoReal =
    totalInicialArs > 0
      ? (1 + totalRetornoNominal) / (1 + inflAcum / 100) - 1
      : 0

  return {
    posiciones: resultados,
    ranking,
    ganador: ranking[0] ?? null,
    dolarFinalArs,
    inflacionAcumuladaPct: inflAcum,
    totalInicialArs,
    totalFinalArs,
    totalFinalUsd,
    totalRetornoRealPct: totalRetornoReal * 100,
  }
}

// ── Catálogo de instrumentos disponibles ─────────────────────────────────────
export interface InstrumentoInfo {
  tipo: InstrumentoTipo
  nombre: string
  descripcion: string
  colorHint: string // color sugerido para gráficos
}

export const CATALOGO: InstrumentoInfo[] = [
  {
    tipo: "PF_TRADICIONAL",
    nombre: "Plazo fijo tradicional",
    descripcion: "Rinde TAMAR ≈ TPM + spread. Vulnerable a inflación y salto del dólar.",
    colorHint: "#74A9C9",
  },
  {
    tipo: "PF_UVA",
    nombre: "Plazo fijo UVA",
    descripcion: "Ajusta por CER (inflación) + ~1 % anual. Cobertura contra inflación.",
    colorHint: "#6BD4A8",
  },
  {
    tipo: "LECAP",
    nombre: "LECAP",
    descripcion: "Letra capitalizable a tasa fija. TEM ≈ TPM / 12.",
    colorHint: "#F0C040",
  },
  {
    tipo: "BONO_DOLLAR_LINKED",
    nombre: "Bono dollar-linked",
    descripcion: "Ajusta por variación del dólar oficial + TIR chica. Cobertura contra devaluación.",
    colorHint: "#E8944A",
  },
  {
    tipo: "BONO_CER",
    nombre: "Bono CER",
    descripcion: "Ajusta por inflación + spread real. Cobertura contra IPC.",
    colorHint: "#6BD4A8",
  },
  {
    tipo: "DOLAR_MEP",
    nombre: "Dólar MEP",
    descripcion: "Comprás dólares hoy y los mantenés. Sigue 1 a 1 el precio del MEP.",
    colorHint: "#4FC3F7",
  },
  {
    tipo: "EFECTIVO_PESOS",
    nombre: "Efectivo en pesos",
    descripcion: "Base de comparación: no rinde nada, se lo come todo la inflación.",
    colorHint: "#E67B6B",
  },
]

// ── Parser de querystring para reproducir escenarios ─────────────────────────
export interface EscenarioSerializable {
  dolar: number
  ipc: number
  tpm: number
  horizonte: number
  posiciones: { tipo: InstrumentoTipo; monto: number }[]
}

export function escenarioAQueryString(esc: EscenarioSerializable): string {
  const params = new URLSearchParams()
  params.set("dolar", esc.dolar.toString())
  params.set("ipc", esc.ipc.toString())
  params.set("tpm", esc.tpm.toString())
  params.set("horizonte", esc.horizonte.toString())
  esc.posiciones.forEach((p, i) => {
    params.set(`p${i}`, `${p.tipo}:${p.monto}`)
  })
  return params.toString()
}

export function escenarioDeQueryString(
  params: URLSearchParams,
): Partial<EscenarioSerializable> {
  const result: Partial<EscenarioSerializable> = {}
  const dolar = params.get("dolar")
  const ipc = params.get("ipc")
  const tpm = params.get("tpm")
  const horizonte = params.get("horizonte")
  if (dolar != null && !Number.isNaN(Number(dolar))) result.dolar = Number(dolar)
  if (ipc != null && !Number.isNaN(Number(ipc))) result.ipc = Number(ipc)
  if (tpm != null && !Number.isNaN(Number(tpm))) result.tpm = Number(tpm)
  if (horizonte != null && !Number.isNaN(Number(horizonte)))
    result.horizonte = Number(horizonte)

  const posiciones: EscenarioSerializable["posiciones"] = []
  const tiposValidos = new Set<InstrumentoTipo>(CATALOGO.map(c => c.tipo))
  for (let i = 0; i < 20; i++) {
    const raw = params.get(`p${i}`)
    if (!raw) continue
    const [tipoRaw, montoRaw] = raw.split(":")
    if (!tipoRaw || !montoRaw) continue
    if (!tiposValidos.has(tipoRaw as InstrumentoTipo)) continue
    const monto = Number(montoRaw)
    if (Number.isNaN(monto) || monto <= 0) continue
    posiciones.push({ tipo: tipoRaw as InstrumentoTipo, monto })
  }
  if (posiciones.length > 0) result.posiciones = posiciones
  return result
}
