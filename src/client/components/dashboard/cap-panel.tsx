"use client"

/**
 * Panel LECAP / BONCAP: curva TEM vs duration a la izquierda, screener a la
 * derecha.
 *
 * Los precios vienen de BYMA Data con 20 min de demora; el pago final, de la
 * condición de emisión. El Px dirty de cada fila se puede pisar con un click
 * para simular otro precio: la fila y su punto en la curva se recalculan acá
 * mismo, con la misma matemática que usa el server (src/lib/cap-math.ts).
 */

import { useEffect, useMemo, useState } from "react"
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts"
import { Info, RotateCcw } from "lucide-react"
import { metricasCap } from "@/lib/cap-math"
import { fechaUTC } from "@/lib/market-calendar"

export interface CapRow {
  ticker: string
  tipo: "LECAP" | "BONCAP"
  emision: string | null
  vencimiento: string
  fechaLiquidacion: string
  diasVencimiento: number
  precio: number | null
  pagoFinal: number | null
  temEmision: number | null
  tem: number | null
  tna: number | null
  tea: number | null
  durationMac: number | null
  durationMod: number | null
  paridad: number | null
  asOf: string | null
  sinTerminos: boolean
}

type Fila = CapRow & { editado: boolean; precioMercado: number | null }
type EjeX = "mod" | "mac"
type Punto = { ticker: string; tipo: CapRow["tipo"]; x: number; tem: number; vencimiento: string; dias: number; editado: boolean; labelArriba: boolean }

const COLOR = { LECAP: "var(--amber)", BONCAP: "var(--sky)" } as const

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(v: number | null | undefined, decimals = 2): string {
  return v == null || !Number.isFinite(v) ? "—" : `${fmtNum(v, decimals)}%`
}

/** "2026-09-30" → "30/09/2026". */
function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function horaBuenosAires(iso: string | null): string | null {
  if (!iso) return null
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null
  return fecha.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false })
}

/** Paso de grilla "redondo" para que el eje no termine en valores como 0,67. */
function pasoLindo(rango: number, maxTicks: number): number {
  const candidatos = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5]
  return candidatos.find((paso) => rango / paso <= maxTicks) ?? 10
}

function ticksEntre(min: number, max: number, paso: number): number[] {
  const ticks: number[] = []
  for (let v = min; v <= max + paso / 1000; v += paso) ticks.push(Number(v.toFixed(6)))
  return ticks
}

/** Acepta coma o punto decimal. Devuelve null si no es un precio válido. */
function parsePrecio(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, "")
  const normalizado = limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio
  const valor = Number(normalizado)
  return Number.isFinite(valor) && valor > 0 ? valor : null
}

function recalcular(row: CapRow, precio: number): Fila {
  const base: Fila = { ...row, precio, editado: true, precioMercado: row.precio }
  if (row.emision == null || row.temEmision == null || row.pagoFinal == null) return base
  const m = metricasCap(
    precio,
    { emision: row.emision, vencimiento: row.vencimiento, temEmision: row.temEmision, pagoFinal: row.pagoFinal },
    fechaUTC(row.fechaLiquidacion),
  )
  return {
    ...base,
    tem: m?.tem ?? null,
    tna: m?.tna ?? null,
    tea: m?.tea ?? null,
    durationMac: m?.durationMac ?? null,
    durationMod: m?.durationMod ?? null,
    paridad: m?.paridad ?? null,
  }
}

function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, color: "#ccc", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>
      {children}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipCurva({ active, payload, ejeX }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as Punto | undefined
  if (!p) return null
  return (
    <div style={{ background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)", padding: "8px 12px", fontSize: 11, fontFamily: "var(--font-data)" }}>
      <div style={{ color: COLOR[p.tipo], fontWeight: 700, marginBottom: 4 }}>{p.ticker} · {p.tipo}</div>
      <div style={{ color: "#ccc" }}>TEM: <span style={{ color: "var(--text)", fontWeight: 700 }}>{fmtPct(p.tem)}</span></div>
      <div style={{ color: "#ccc" }}>Vence: <span style={{ color: "var(--text)" }}>{fmtFecha(p.vencimiento)}</span> · {p.dias} días</div>
      <div style={{ color: "var(--text-dim)" }}>{ejeX === "mod" ? "Dur. mod." : "Duration"}: {fmtNum(p.x, 3)} años</div>
      {p.editado && <div style={{ color: "var(--amber)", marginTop: 4 }}>Con Px dirty editado</div>}
    </div>
  )
}

export function CapPanel({ selectedTicker, onSelect }: { selectedTicker?: string | null; onSelect?: (ticker: string) => void }) {
  const [rows, setRows] = useState<CapRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState("")
  const [ocultos, setOcultos] = useState<Set<string>>(() => new Set())
  const [ejeX, setEjeX] = useState<EjeX>("mod")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/bonos?tipo=lecap", { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.data)) setRows(j.data as CapRow[])
        else setError(j.error ?? "respuesta sin datos")
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "no se pudo conectar")
      })
    return () => controller.abort()
  }, [])

  const filas: Fila[] = useMemo(
    () => (rows ?? []).map((row) =>
      overrides[row.ticker] != null
        ? recalcular(row, overrides[row.ticker])
        : { ...row, editado: false, precioMercado: row.precio },
    ),
    [rows, overrides],
  )

  const conMetricas = filas.filter((f) => f.tem != null && f.durationMod != null && f.durationMac != null)

  const puntos: Punto[] = conMetricas
    .filter((f) => !ocultos.has(f.ticker))
    .map((f) => ({
      ticker: f.ticker,
      tipo: f.tipo,
      x: (ejeX === "mod" ? f.durationMod : f.durationMac) as number,
      tem: f.tem as number,
      vencimiento: f.vencimiento,
      dias: f.diasVencimiento,
      editado: f.editado,
      labelArriba: true,
    }))
    .sort((a, b) => a.x - b.x)
    // Labels alternados arriba y abajo: dos letras con duration parecida
    // (T15E7 y S29E7) quedan pegadas y sus tickers se pisaban.
    .map((p, i) => ({ ...p, labelArriba: i % 2 === 0 }))

  const ultimaHora = horaBuenosAires(
    (rows ?? []).map((r) => r.asOf).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null,
  )
  const fechaLiquidacion = rows?.[0]?.fechaLiquidacion ?? null
  const hayEdiciones = Object.keys(overrides).length > 0

  function empezarEdicion(fila: Fila) {
    setEditando(fila.ticker)
    setBorrador(fila.precio != null ? fmtNum(fila.precio, 3) : "")
  }

  function confirmarEdicion() {
    if (editando == null) return
    const ticker = editando
    const valor = parsePrecio(borrador)
    const mercado = rows?.find((r) => r.ticker === ticker)?.precio ?? null
    setEditando(null)
    if (valor == null) return
    setOverrides((prev) => {
      const next = { ...prev }
      if (mercado != null && Math.abs(valor - mercado) < 1e-9) delete next[ticker]
      else next[ticker] = valor
      return next
    })
  }

  function restablecer(ticker: string) {
    setOverrides((prev) => {
      const next = { ...prev }
      delete next[ticker]
      return next
    })
  }

  function alternarBono(ticker: string) {
    setOcultos((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  if (error) {
    return (
      <div style={{ padding: 16, background: "var(--bg)", fontFamily: "var(--font-data)" }}>
        <div style={{ color: "var(--negative)", fontSize: 12, marginBottom: 6 }}>No se pudo cargar LECAP / BONCAP.</div>
        <div style={{ color: "var(--text-mute)", fontSize: 11 }}>{error}</div>
      </div>
    )
  }

  if (rows == null) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>Cargando LECAP / BONCAP…</div>
  }

  const xs = puntos.map((p) => p.x)
  const ys = puntos.map((p) => p.tem)
  const xTope = xs.length ? Math.max(...xs) * 1.08 : 1
  const xPaso = pasoLindo(xTope, 7)
  const xMax = Math.ceil(xTope / xPaso) * xPaso
  const yBajo = ys.length ? Math.min(...ys) - 0.03 : 0
  const yAlto = ys.length ? Math.max(...ys) + 0.03 : 1
  const yPaso = pasoLindo(yAlto - yBajo, 6)
  const yMin = Math.floor(yBajo / yPaso) * yPaso
  const yMax = Math.ceil(yAlto / yPaso) * yPaso

  // Los encabezados pueden partirse en dos líneas: así la tabla entra al lado
  // de la curva en una tarjeta de ancho normal.
  const th: React.CSSProperties = { padding: "6px 6px", color: "var(--text-dim)", fontWeight: 400, textAlign: "right", whiteSpace: "normal", lineHeight: 1.25, verticalAlign: "bottom", borderBottom: "1px solid var(--border)" }
  const td: React.CSSProperties = { padding: "5px 6px", textAlign: "right", whiteSpace: "nowrap" }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 1, background: "var(--bg-elev-2)" }}>
      {/* ── Curva ─────────────────────────────────────────────────────── */}
      <div style={{ flex: "1 1 300px", minWidth: 0, background: "var(--bg)", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <TituloSeccion>Curva LECAP / BONCAP — TEM vs duration</TituloSeccion>
          <div role="group" aria-label="Eje horizontal" style={{ display: "flex", border: "1px solid var(--border)" }}>
            {([["mod", "Dur. mod."], ["mac", "Duration"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={ejeX === key}
                onClick={() => setEjeX(key)}
                style={{
                  fontSize: 9, fontFamily: "var(--font-data)", padding: "3px 10px", cursor: "pointer", border: "none",
                  background: ejeX === key ? "rgba(232,148,74,0.14)" : "transparent",
                  color: ejeX === key ? "var(--amber)" : "var(--text-dim)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Qué bonos entran en la curva */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8, alignItems: "center" }}>
          {conMetricas.map((f) => {
            const visible = !ocultos.has(f.ticker)
            return (
              <button
                key={f.ticker}
                type="button"
                aria-pressed={visible}
                onClick={() => alternarBono(f.ticker)}
                title={visible ? `Sacar ${f.ticker} de la curva` : `Mostrar ${f.ticker} en la curva`}
                style={{
                  fontSize: 9, fontFamily: "var(--font-data)", padding: "3px 8px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${visible ? COLOR[f.tipo] : "var(--border)"}`,
                  background: "transparent",
                  color: visible ? COLOR[f.tipo] : "var(--text-mute)",
                  opacity: visible ? 1 : 0.6,
                }}
              >
                {f.ticker}
              </button>
            )
          })}
          <span style={{ width: 6 }} />
          <button type="button" onClick={() => setOcultos(new Set())} style={{ fontSize: 9, fontFamily: "var(--font-data)", background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", textDecoration: "underline" }}>Todos</button>
          <button type="button" onClick={() => setOcultos(new Set(conMetricas.map((f) => f.ticker)))} style={{ fontSize: 9, fontFamily: "var(--font-data)", background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", textDecoration: "underline" }}>Ninguno</button>
        </div>

        {puntos.length === 0 ? (
          <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-mute)", fontSize: 10, fontFamily: "var(--font-data)" }}>
            Elegí al menos un bono para ver la curva.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 16, right: 24, left: 4, bottom: 16 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                type="number" dataKey="x" domain={[0, xMax]} ticks={ticksEntre(0, xMax, xPaso)}
                tick={{ fill: "var(--text-mute)", fontSize: 9 }}
                tickFormatter={(v: number) => fmtNum(v, 2)}
                axisLine={{ stroke: "var(--border-hi)" }} tickLine={false}
                label={{ value: ejeX === "mod" ? "Duration modificada (años)" : "Duration (años)", position: "insideBottom", offset: -8, fill: "var(--text-mute)", fontSize: 9 }}
              />
              <YAxis
                type="number" dataKey="tem" domain={[yMin, yMax]} ticks={ticksEntre(yMin, yMax, yPaso)}
                tick={{ fill: "var(--text-mute)", fontSize: 9 }}
                tickFormatter={(v: number) => `${fmtNum(v, 2)}%`}
                axisLine={{ stroke: "var(--border-hi)" }} tickLine={false} width={48}
                label={{ value: "TEM", angle: -90, position: "insideLeft", fill: "var(--text-mute)", fontSize: 9 }}
              />
              <Tooltip content={<TooltipCurva ejeX={ejeX} />} cursor={{ strokeDasharray: "3 3", stroke: "var(--border-hi)" }} isAnimationActive={false} />
              <Scatter
                data={puntos}
                isAnimationActive={false}
                line={{ stroke: "var(--border-hi)", strokeWidth: 1 }}
                lineType="joint"
                shape={(props: { cx?: number; cy?: number; payload?: Punto }) => {
                  const { cx, cy, payload } = props
                  if (cx == null || cy == null || !payload) return <g />
                  return (
                    <g>
                      <circle
                        cx={cx} cy={cy}
                        r={payload.editado ? 6 : 5}
                        fill={COLOR[payload.tipo]}
                        stroke={payload.editado ? "var(--text)" : "var(--bg)"}
                        strokeWidth={payload.editado ? 2 : 1}
                      />
                      <text
                        x={cx} y={payload.labelArriba ? cy - 10 : cy + 17}
                        textAnchor="middle" fill="var(--text-dim)" fontSize={9}
                        style={{ pointerEvents: "none" }}
                      >
                        {payload.ticker}
                      </text>
                    </g>
                  )
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}

        <div style={{ display: "flex", gap: 14, fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--font-data)", marginTop: 4 }}>
          <span><span style={{ color: COLOR.LECAP }}>●</span> LECAP</span>
          <span><span style={{ color: COLOR.BONCAP }}>●</span> BONCAP</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", border: "2px solid var(--text)", verticalAlign: "middle" }} /> Px dirty editado</span>
        </div>
      </div>

      {/* ── Screener ──────────────────────────────────────────────────── */}
      <div style={{ flex: "1.8 1 520px", minWidth: 0, background: "var(--bg)", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <TituloSeccion>Screener LECAP / BONCAP</TituloSeccion>
          {ultimaHora && (
            <span style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>última operación {ultimaHora}</span>
          )}
        </div>

        <div
          role="note"
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 10,
            background: "rgba(232,148,74,0.08)", border: "1px solid rgba(232,148,74,0.35)",
            color: "var(--amber)", fontSize: 10, fontFamily: "var(--font-data)",
          }}
        >
          <Info size={12} aria-hidden />
          Los precios vienen de la API de BYMADATA, tienen 20 min de demora
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-data)", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Ticker</th>
                <th style={th}>Fecha vto</th>
                <th style={th}>Días a vto</th>
                <th style={th}>Px dirty</th>
                <th style={th}>Px Finish</th>
                <th style={th}>TEM</th>
                <th style={th}>TNA</th>
                <th style={th}>TEA</th>
                <th style={th}>Dur. Mod.</th>
                <th style={th}>Paridad</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const seleccionada = selectedTicker === f.ticker
                const sinDato = f.sinTerminos ? "Falta cargar la condición de emisión (pago final) de este instrumento" : undefined
                return (
                  <tr
                    key={f.ticker}
                    onClick={onSelect ? () => onSelect(f.ticker) : undefined}
                    style={{
                      borderBottom: "1px solid var(--bg-elev-2)",
                      cursor: onSelect ? "pointer" : "default",
                      background: seleccionada ? "var(--bg-elev-2)" : "transparent",
                    }}
                  >
                    <td style={{ ...td, textAlign: "left", fontWeight: 700, color: COLOR[f.tipo] }}>{f.ticker}</td>
                    <td style={{ ...td, color: "var(--text-dim)" }}>{fmtFecha(f.vencimiento)}</td>
                    <td style={{ ...td, color: "var(--text-dim)" }}>{f.diasVencimiento}</td>
                    <td
                      style={{ ...td, background: f.editado ? "rgba(232,148,74,0.12)" : "transparent" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {editando === f.ticker ? (
                        <input
                          autoFocus
                          inputMode="decimal"
                          aria-label={`Px dirty de ${f.ticker}`}
                          value={borrador}
                          onChange={(e) => setBorrador(e.target.value)}
                          onFocus={(e) => e.target.select()}
                          onBlur={confirmarEdicion}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmarEdicion()
                            if (e.key === "Escape") setEditando(null)
                          }}
                          style={{
                            width: 88, textAlign: "right", font: "inherit", color: "var(--text)",
                            background: "var(--bg-elev)", border: "1px solid var(--amber)", padding: "1px 4px", outline: "none",
                          }}
                        />
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {f.editado && (
                            <button
                              type="button"
                              onClick={() => restablecer(f.ticker)}
                              title={`Volver al precio de BYMA (${fmtNum(f.precioMercado, 3)})`}
                              aria-label={`Volver al precio de BYMA de ${f.ticker}`}
                              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--amber)", display: "inline-flex" }}
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => empezarEdicion(f)}
                            title="Click para simular otro precio"
                            style={{
                              background: "transparent", border: "none", borderBottom: "1px dashed var(--border-hi)",
                              padding: 0, font: "inherit", cursor: "text",
                              color: f.editado ? "var(--amber)" : "var(--text)", fontWeight: f.editado ? 700 : 400,
                            }}
                          >
                            {fmtNum(f.precio, 3)}
                          </button>
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, color: "var(--text-dim)" }} title={sinDato}>{fmtNum(f.pagoFinal, 3)}</td>
                    <td style={{ ...td, color: "var(--text)", fontWeight: 700 }} title={sinDato}>{fmtPct(f.tem)}</td>
                    <td style={{ ...td, color: "var(--text-dim)" }} title={sinDato}>{fmtPct(f.tna)}</td>
                    <td style={{ ...td, color: "var(--text-dim)" }} title={sinDato}>{fmtPct(f.tea)}</td>
                    <td style={{ ...td, color: "var(--text-dim)" }} title={sinDato}>{fmtNum(f.durationMod, 3)}</td>
                    <td style={{ ...td, color: "var(--text-dim)" }} title={sinDato}>{fmtPct(f.paridad)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
          <div style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)", lineHeight: 1.7, flex: "1 1 320px" }}>
            Click en el Px dirty para simular otro precio. Días contados desde la liquidación 24 hs
            {fechaLiquidacion ? ` (${fmtFecha(fechaLiquidacion)})` : ""}.
            <br />
            TEM = (VF/P)^(30/d) − 1 · TNA = TEM × 12 · TEA = (VF/P)^(365/d) − 1 · Dur. mod. = (d/365) / (1 + TEA) ·
            Paridad = P / valor técnico capitalizado a la TEM de emisión.
          </div>
          {hayEdiciones && (
            <button
              type="button"
              onClick={() => setOverrides({})}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9, fontFamily: "var(--font-data)",
                padding: "4px 10px", cursor: "pointer", background: "transparent",
                border: "1px solid rgba(232,148,74,0.4)", color: "var(--amber)",
              }}
            >
              <RotateCcw size={11} /> Volver a precios de mercado
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
