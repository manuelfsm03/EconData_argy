"use client"

import { useEffect, useState } from "react"
import { Calculator, Landmark } from "lucide-react"
import { ESQUEMAS } from "@/lib/bond-schedule"
import { cn } from "@/lib/utils"

// ── Tipos de la respuesta de /api/bonos/calculadora (ver src/lib/bond-math.ts) ──
interface MetricasBono {
  valorResidual: number
  amortizado: number
  interesesCorridos: number
  valorTecnico: number
  tasaVigente: number
  proximoPago: string
  proximoFlujo: number
  flujoRemanente: number
  rentaProximos12m: number
  vidaPromedio: number
  plazoResidual: number
  tir: number
  duration: number
  durationMod: number
  convexity: number
  paridad: number
  currentYield: number
  precioClean: number
}
interface FlujoFuturo { fecha: string; cupon: number; amortizacion: number; total: number }
interface RespuestaCalculadora {
  ticker: string
  modo: "precio" | "tir"
  valorIngresado: number
  liquidacion: string
  metricas: MetricasBono
  flujosFuturos: FlujoFuturo[]
  nota: string
}
interface ErrorApi { error: string; disponibles?: string[] }

function fmt(v: number | undefined, dec = 2): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function Metrica({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wide text-[var(--text-mute)]">{label}</div>
      <div className="mt-0.5 font-mono text-base font-semibold text-[var(--text)]">
        {value} {unit && <span className="text-[10px] font-normal text-[var(--text-dim)]">{unit}</span>}
      </div>
    </div>
  )
}

export function BondsWorkspace() {
  const [ticker, setTicker] = useState(ESQUEMAS[0]?.ticker ?? "")
  const [modo, setModo] = useState<"precio" | "tir">("precio")
  const [valor, setValor] = useState("")
  const [precioMercado, setPrecioMercado] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<RespuestaCalculadora | null>(null)

  // Precarga con el precio de mercado en vivo (BYMA Data vía /api/bonos) cada
  // vez que cambia el ticker -- el usuario puede editarlo para simular otro
  // escenario, esto solo evita arrancar de un campo vacío/hardcodeado.
  useEffect(() => {
    if (!ticker) return
    let cancelado = false
    setPrecioMercado(null)
    fetch(`/api/bonos?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelado) return
        const precio = j?.data?.precio
        if (typeof precio === "number") {
          setPrecioMercado(precio)
          setModo("precio")
          setValor(String(precio))
        }
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [ticker])

  async function calcular(e: React.FormEvent) {
    e.preventDefault()
    const num = Number(valor)
    if (!ticker || !Number.isFinite(num) || num <= 0) {
      setError("Ingresá un valor numérico positivo")
      return
    }
    setLoading(true)
    setError(null)
    setResultado(null)
    try {
      const params = new URLSearchParams({ ticker, modo, valor: String(num) })
      const response = await fetch(`/api/bonos/calculadora?${params.toString()}`)
      const payload = (await response.json()) as RespuestaCalculadora | ErrorApi
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "No se pudo calcular")
      }
      setResultado(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo calcular")
    } finally {
      setLoading(false)
    }
  }

  const m = resultado?.metricas

  return (
    <div className="min-h-[calc(100vh-49px)] bg-[var(--bg)] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--amber-soft)] text-[var(--amber)]"><Landmark size={20} /></div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">Bonos</h1>
            <p className="text-xs text-[var(--text-dim)]">Calculadora precio ↔ TIR sobre el motor de bonos verificado.</p>
          </div>
        </div>

        <div className="mb-4 rounded-md border border-[var(--border)] bg-[var(--amber-soft)] px-3 py-2 text-[10px] leading-4 text-[var(--text-dim)]">
          Solo se listan tickers con cashflow verificado contra el prospecto (hoy: {ESQUEMAS.map((e) => e.ticker).join(", ")}). El resto de los bonos todavía no pasó por esa validación — antes de sumarlos acá preferimos no mostrar un número que parezca firme sin serlo.
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* ── Panel de inputs ── */}
          <section className="h-fit rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text)]"><Calculator size={14} className="text-[var(--amber)]" /> Calculadora</div>
            <form onSubmit={calcular} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-mute)]">Bono</span>
                <select value={ticker} onChange={(e) => setTicker(e.target.value)} className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--amber)]">
                  {ESQUEMAS.map((e) => <option key={e.ticker} value={e.ticker}>{e.ticker} — {e.nombre}</option>)}
                </select>
              </label>

              <div className="flex rounded-md border border-[var(--border)] bg-[var(--bg)] p-1">
                <button type="button" onClick={() => setModo("precio")} className={cn("h-7 flex-1 rounded text-[10px] font-medium", modo === "precio" ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "text-[var(--text-dim)]")}>Tengo el precio</button>
                <button type="button" onClick={() => setModo("tir")} className={cn("h-7 flex-1 rounded text-[10px] font-medium", modo === "tir" ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "text-[var(--text-dim)]")}>Tengo la TIR</button>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-mute)]">{modo === "precio" ? "Precio clean" : "TIR objetivo (%)"}</span>
                <input type="number" step="any" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={modo === "precio" ? "ej. 65.30" : "ej. 12.5"} className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] outline-none focus:border-[var(--amber)]" required />
                {modo === "precio" && precioMercado != null && (
                  <span className="text-[9px] text-[var(--text-mute)]">
                    Precargado con el precio de mercado de {ticker} ({fmt(precioMercado)}, BYMA Data) — editalo para simular otro escenario.
                  </span>
                )}
              </label>

              {error && <p className="text-[10px] text-[var(--negative)]">{error}</p>}

              <button type="submit" disabled={loading} className="h-9 rounded-md bg-[var(--amber)] text-xs font-semibold text-black disabled:opacity-50">
                {loading ? "Calculando…" : "Calcular"}
              </button>
            </form>
          </section>

          {/* ── Resultados ── */}
          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            {!resultado ? (
              <div className="flex h-full min-h-40 items-center justify-center text-center text-xs text-[var(--text-dim)]">
                Elegí un bono, ingresá un precio o una TIR, y calculá para ver las métricas.
              </div>
            ) : (
              <>
                <div className="mb-3 text-[10px] text-[var(--text-mute)]">
                  {resultado.ticker} · liquidación {resultado.liquidacion} · simulación, no usa precio de mercado en vivo
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  <Metrica label="TIR" value={fmt(m?.tir)} unit="% anual" />
                  <Metrica label="Precio clean" value={fmt(m?.precioClean)} />
                  <Metrica label="Paridad" value={fmt(m?.paridad)} unit="%" />
                  <Metrica label="Duration mod." value={fmt(m?.durationMod)} unit="años" />
                  <Metrica label="Convexity" value={fmt(m?.convexity)} />
                  <Metrica label="Current yield" value={fmt(m?.currentYield)} unit="%" />
                  <Metrica label="Intereses corridos" value={fmt(m?.interesesCorridos)} />
                  <Metrica label="Valor técnico" value={fmt(m?.valorTecnico)} />
                  <Metrica label="Valor residual" value={fmt(m?.valorResidual)} />
                  <Metrica label="Amortizado" value={fmt(m?.amortizado)} unit="%" />
                  <Metrica label="Vida promedio" value={fmt(m?.vidaPromedio)} unit="años" />
                  <Metrica label="Próximo pago" value={m?.proximoPago ?? "—"} />
                </div>

                {resultado.flujosFuturos.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-mute)]">Flujos futuros</div>
                    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-left text-[var(--text-mute)]">
                            <th className="px-2 py-1.5">Fecha</th>
                            <th className="px-2 py-1.5 text-right">Cupón</th>
                            <th className="px-2 py-1.5 text-right">Amortización</th>
                            <th className="px-2 py-1.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.flujosFuturos.map((f) => (
                            <tr key={f.fecha} className="border-b border-[var(--border)] last:border-0">
                              <td className="px-2 py-1.5 font-mono text-[var(--text)]">{f.fecha}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-[var(--text-dim)]">{fmt(f.cupon)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-[var(--text-dim)]">{fmt(f.amortizacion)}</td>
                              <td className="px-2 py-1.5 text-right font-mono font-semibold text-[var(--text)]">{fmt(f.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
