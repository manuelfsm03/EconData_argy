/**
 * TabBonos — Screener de bonos soberanos HD + LECAPs
 *
 * API:
 *   /api/bonos               — screener soberanos (AL/GD)
 *   /api/bonos?tipo=lecap    — screener LECAPs/BONCAPs
 *   /api/bonos?ticker=AL30   — detalle de un bono
 *
 * Fase 1 — M1.1 + M1.3 del ROADMAP
 */

"use client"

import { useState, useEffect, useCallback } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SovereignBond {
  ticker: string
  nombre: string
  ley: string
  cupon: number
  vencimiento: string
  precio: number | null
  paridad: number | null
  tir: number | null
  currentYield: number | null
  durationMod: number | null
  vnResidual: number
  fuente: string
  flujosFF?: {
    fecha: string
    cupon: number
    amortizacion: number
    total: number
  }[]
}

interface CapInstrument {
  ticker: string
  tipo: string
  vencimiento: string
  diasVencimiento: number
  precio: number | null
  tir: number | null
  tea: number | null
  tem: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined, dec = 2): string {
  if (v == null) return "—"
  return v.toFixed(dec) + "%"
}

function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null) return "—"
  return v.toFixed(dec)
}

function tirColor(tir: number | null | undefined): string {
  if (tir == null) return "#555"
  if (tir > 15) return "#4AF6C3"
  if (tir > 10) return "#FFA028"
  return "#FF433D"
}

function SubTabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            background: active === t.key ? "#0d0d0d" : "transparent",
            color: active === t.key ? "#FFA028" : "#555",
            border: "none",
            borderBottom: active === t.key ? "2px solid #FFA028" : "2px solid transparent",
            padding: "6px 16px",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Soberanos Screener ────────────────────────────────────────────────────────

type SortKey = keyof Pick<SovereignBond, "ticker" | "tir" | "paridad" | "durationMod" | "currentYield" | "precio">

function SoberanosScreener() {
  const [bonds, setBonds] = useState<SovereignBond[]>([])
  const [selected, setSelected] = useState<SovereignBond | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("tir")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    fetch("/api/bonos")
      .then((r) => r.json())
      .then((j) => {
        setBonds(j.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const loadDetail = useCallback(async (ticker: string) => {
    try {
      const r = await fetch(`/api/bonos?ticker=${ticker}`)
      const j = await r.json()
      setSelected(j.data)
    } catch {}
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 24, color: "#555", fontSize: 11, textAlign: "center" }}>
        Cargando screener de bonos soberanos...
        <br />
        <span style={{ fontSize: 9, color: "#333" }}>Si es la primera vez, ejecutar: npx ts-node prisma/seed-bonds.ts</span>
      </div>
    )
  }

  if (bonds.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ color: "#FF433D", fontSize: 12, marginBottom: 8 }}>
          No hay bonos en la base de datos.
        </div>
        <div style={{ color: "#555", fontSize: 11 }}>
          Ejecutar seed: <code style={{ color: "#FFA028" }}>npx ts-node prisma/seed-bonds.ts</code>
        </div>
      </div>
    )
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sorted = [...bonds].sort((a, b) => {
    const va = a[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity)
    const vb = b[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity)
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
  })

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k
    return (
      <th
        onClick={() => handleSort(k)}
        style={{
          padding: "4px 8px",
          fontSize: 9,
          color: active ? "#FFA028" : "#555",
          textAlign: "right",
          cursor: "pointer",
          borderBottom: "1px solid #1a1a1a",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </th>
    )
  }

  return (
    <div>
      {/* Screener table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: "left", borderBottom: "1px solid #1a1a1a" }}>
                TICKER
              </th>
              <th style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: "left", borderBottom: "1px solid #1a1a1a" }}>
                LEY
              </th>
              <th style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #1a1a1a" }}>
                VTO
              </th>
              <th style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #1a1a1a" }}>
                CUPÓN
              </th>
              <SortTh k="precio" label="PRECIO" />
              <SortTh k="paridad" label="PARIDAD" />
              <SortTh k="tir" label="TIR" />
              <SortTh k="currentYield" label="CY" />
              <SortTh k="durationMod" label="DUR MOD" />
              <th style={{ padding: "4px 8px", fontSize: 9, color: "#555", borderBottom: "1px solid #1a1a1a" }}>
                FUENTE
              </th>
              <th style={{ padding: "4px 8px", fontSize: 9, color: "#555", borderBottom: "1px solid #1a1a1a" }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((bond, i) => (
              <tr
                key={bond.ticker}
                style={{
                  background: selected?.ticker === bond.ticker ? "#0d0d0d" : i % 2 === 0 ? "#060606" : "#080808",
                  cursor: "pointer",
                  borderLeft: selected?.ticker === bond.ticker ? "2px solid #FFA028" : "2px solid transparent",
                }}
                onClick={() => loadDetail(bond.ticker)}
              >
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "#FFA028" }}>
                  {bond.ticker}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 10, color: bond.ley === "NY" ? "#4488ff" : "#888" }}>
                  {bond.ley}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 10, color: "#777", textAlign: "right" }}>
                  {bond.vencimiento.slice(0, 7)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#ccc", textAlign: "right", fontFamily: "monospace" }}>
                  {fmtPct(bond.cupon)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                  {fmtNum(bond.precio)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#ccc", textAlign: "right", fontFamily: "monospace" }}>
                  {fmtPct(bond.paridad)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: tirColor(bond.tir), textAlign: "right", fontFamily: "monospace" }}>
                  {fmtPct(bond.tir)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#888", textAlign: "right", fontFamily: "monospace" }}>
                  {fmtPct(bond.currentYield)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#888", textAlign: "right", fontFamily: "monospace" }}>
                  {fmtNum(bond.durationMod)}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 9, color: "#444" }}>
                  {bond.fuente}
                </td>
                <td style={{ padding: "5px 8px" }}>
                  <span style={{ fontSize: 9, color: "#333" }}>▶</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ background: "#060606", border: "1px solid #1a1a1a", margin: 1, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#FFA028" }}>{selected.ticker}</span>
              <span style={{ fontSize: 11, color: "#666", marginLeft: 8 }}>{selected.nombre}</span>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12 }}
            >
              ✕
            </button>
          </div>

          {/* KPIs */}
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "#111", padding: 1, marginBottom: 1 }}>
            {[
              { label: "Precio", value: fmtNum(selected.precio), unit: "USD" },
              { label: "TIR", value: fmtPct(selected.tir), unit: "anual", color: tirColor(selected.tir) },
              { label: "Paridad", value: fmtPct(selected.paridad), unit: "% VN residual" },
              { label: "Current Yield", value: fmtPct(selected.currentYield), unit: "anual" },
              { label: "Duration Mod.", value: fmtNum(selected.durationMod, 2), unit: "años" },
              { label: "VN Residual", value: fmtPct(selected.vnResidual), unit: "% original" },
            ].map((kpi) => (
              <div key={kpi.label} style={{ flex: "1 1 130px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "8px 12px" }}>
                <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 700, color: kpi.color ?? "#FFA028" }}>{kpi.value}</div>
                <div style={{ fontSize: 9, color: "#444" }}>{kpi.unit}</div>
              </div>
            ))}
          </div>

          {/* Flujos de pago */}
          {selected.flujosFF && selected.flujosFF.length > 0 && (
            <>
              <div style={{ padding: "3px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111", marginTop: 8 }}>
                Flujos de pago futuros — VN = 100
              </div>
              <div style={{ overflowX: "auto", maxHeight: 250 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Fecha", "Cupón", "Amortización", "Total"].map((h) => (
                        <th key={h} style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: h === "Fecha" ? "left" : "right", borderBottom: "1px solid #111" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.flujosFF.map((cf, i) => (
                      <tr key={cf.fecha} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#888" }}>{cf.fecha}</td>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#4AF6C3", textAlign: "right", fontFamily: "monospace" }}>
                          {cf.cupon > 0 ? cf.cupon.toFixed(4) : "—"}
                        </td>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#FFA028", textAlign: "right", fontFamily: "monospace" }}>
                          {cf.amortizacion > 0 ? cf.amortizacion.toFixed(4) : "—"}
                        </td>
                        <td style={{ padding: "3px 8px", fontSize: 10, color: "#fff", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                          {cf.total.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ padding: "4px 8px", fontSize: 9, color: "#333", borderTop: "1px solid #111" }}>
        TIR calculada por Newton-Raphson · Precios: Rava Bursátil · Flujos: prospectos MECON · Hacer click en un bono para ver detalle
      </div>
    </div>
  )
}

// ── LECAPs Screener ────────────────────────────────────────────────────────────

function LecapsScreener() {
  const [instrumentos, setInstrumentos] = useState<CapInstrument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bonos?tipo=lecap")
      .then((r) => r.json())
      .then((j) => { setInstrumentos(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Cargando LECAPs...</div>

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["TICKER", "TIPO", "VENCIMIENTO", "DÍAS", "PRECIO", "TEM", "TEA", "TIR"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: "4px 8px",
                    fontSize: 9,
                    color: "#555",
                    textAlign: i === 0 ? "left" : "right",
                    borderBottom: "1px solid #1a1a1a",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instrumentos.map((inst, i) => (
              <tr key={inst.ticker} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "#FFA028" }}>{inst.ticker}</td>
                <td style={{ padding: "5px 8px", fontSize: 9, color: "#888", textAlign: "right" }}>{inst.tipo}</td>
                <td style={{ padding: "5px 8px", fontSize: 10, color: "#777", textAlign: "right" }}>{inst.vencimiento}</td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: inst.diasVencimiento < 30 ? "#FF433D" : "#ccc", textAlign: "right", fontFamily: "monospace" }}>
                  {inst.diasVencimiento}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#fff", textAlign: "right", fontFamily: "monospace" }}>
                  {inst.precio != null ? inst.precio.toFixed(2) : "—"}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#4AF6C3", textAlign: "right", fontFamily: "monospace" }}>
                  {inst.tem != null ? inst.tem.toFixed(2) + "%" : "—"}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 11, color: "#FFD700", textAlign: "right", fontFamily: "monospace" }}>
                  {inst.tea != null ? inst.tea.toFixed(2) + "%" : "—"}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: tirColor(inst.tir), textAlign: "right", fontFamily: "monospace" }}>
                  {inst.tir != null ? inst.tir.toFixed(2) + "%" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "4px 8px", fontSize: 9, color: "#333", borderTop: "1px solid #111" }}>
        Precios actualizados via cron diario · Fuente: ByMA · Vencimientos: datos.gob.ar
      </div>
    </div>
  )
}

// ── Riesgo País ────────────────────────────────────────────────────────────────

interface RiesgoPaisData {
  actual: {
    riesgoPaisBps: number | null
    spreadAr: number | null
    us10y: number | null
    arTir: number | null
    gd30Precio: number | null
    metodologia: string
  }
  regionales: Record<string, { bps: number | null; moneda: string; nota?: string; ticker?: string }>
  historico: [string, number][]
  alertas: { nivel: string; mensaje: string }[]
}

function RiesgoPaisView() {
  const [data, setData] = useState<RiesgoPaisData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/riesgo-pais")
      .then((r) => r.json())
      .then((j) => { setData(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 16, color: "#555", fontSize: 11 }}>Calculando riesgo país...</div>

  const bps = data?.actual?.riesgoPaisBps
  const bpsColor = bps == null ? "#888" : bps > 2000 ? "#FF433D" : bps > 1000 ? "#FFA028" : bps > 500 ? "#FFD700" : "#4AF6C3"

  return (
    <div>
      {/* KPI principal */}
      <div style={{ display: "flex", gap: 1, padding: 1, background: "#111", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Riesgo País</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: bpsColor, fontFamily: "monospace" }}>
            {bps != null ? bps.toLocaleString("es-AR") : "—"}
          </div>
          <div style={{ fontSize: 10, color: "#444" }}>basis points (bps)</div>
        </div>
        <div style={{ flex: "1 1 130px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>TIR GD30 (est.)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#FFA028", fontFamily: "monospace" }}>
            {data?.actual?.arTir != null ? data.actual.arTir.toFixed(2) + "%" : "—"}
          </div>
          <div style={{ fontSize: 9, color: "#444" }}>anual</div>
        </div>
        <div style={{ flex: "1 1 130px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>US 10Y</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#888", fontFamily: "monospace" }}>
            {data?.actual?.us10y != null ? data.actual.us10y.toFixed(2) + "%" : "—"}
          </div>
          <div style={{ fontSize: 9, color: "#444" }}>Yield treasury</div>
        </div>
        <div style={{ flex: "1 1 130px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>GD30 Precio</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#ccc", fontFamily: "monospace" }}>
            {data?.actual?.gd30Precio != null ? data.actual.gd30Precio.toFixed(1) : "—"}
          </div>
          <div style={{ fontSize: 9, color: "#444" }}>USD (mercado)</div>
        </div>
      </div>

      {/* Alertas */}
      {data?.alertas && data.alertas.length > 0 && (
        <div style={{ margin: "1px 0" }}>
          {data.alertas.map((a, i) => {
            const color = a.nivel === "crítico" ? "#FF433D" : a.nivel === "alto" ? "#FFA028" : a.nivel === "moderado" ? "#FFD700" : "#4AF6C3"
            return (
              <div key={i} style={{ background: "#060606", borderLeft: `3px solid ${color}`, padding: "6px 12px", fontSize: 11, color: "#ccc" }}>
                <span style={{ color, fontWeight: 700, textTransform: "uppercase", fontSize: 9 }}>{a.nivel} </span>
                {a.mensaje}
              </div>
            )
          })}
        </div>
      )}

      {/* Comparativo regional */}
      <div className="bbg-panel-header" style={{ marginTop: 1 }}>COMPARATIVO REGIONAL (EMBI+)</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["País", "Moneda", "EMBI+ (bps)", "Nota"].map((h, i) => (
              <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: i > 1 ? "right" : "left", borderBottom: "1px solid #1a1a1a" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(data?.regionales ?? {}).map(([pais, r], i) => {
            const color = r.bps == null ? "#555" : r.bps > 1000 ? "#FF433D" : r.bps > 500 ? "#FFA028" : r.bps > 200 ? "#FFD700" : "#4AF6C3"
            return (
              <tr key={pais} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                <td style={{ padding: "5px 8px", fontSize: 12, fontWeight: 700, color: "#FFA028", textTransform: "capitalize" }}>{pais}</td>
                <td style={{ padding: "5px 8px", fontSize: 10, color: "#666" }}>{r.moneda}</td>
                <td style={{ padding: "5px 8px", fontSize: 14, fontFamily: "monospace", fontWeight: 700, color, textAlign: "right" }}>
                  {r.bps?.toLocaleString("es-AR") ?? "—"}
                </td>
                <td style={{ padding: "5px 8px", fontSize: 9, color: "#444", textAlign: "right" }}>
                  {r.nota ?? (r.ticker ? `desde ${r.ticker}` : "")}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Histórico */}
      {data?.historico && data.historico.length > 0 && (
        <>
          <div className="bbg-panel-header" style={{ marginTop: 1 }}>SPREAD HISTÓRICO (2 AÑOS, SEMANAL)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "left", borderBottom: "1px solid #111" }}>Fecha</th>
                  <th style={{ padding: "3px 8px", fontSize: 9, color: "#555", textAlign: "right", borderBottom: "1px solid #111" }}>Spread (bps)</th>
                </tr>
              </thead>
              <tbody>
                {data.historico.slice().reverse().slice(0, 40).map(([d, v], i) => {
                  const color = v > 2000 ? "#FF433D" : v > 1000 ? "#FFA028" : v > 500 ? "#FFD700" : "#4AF6C3"
                  return (
                    <tr key={d} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                      <td style={{ padding: "3px 8px", fontSize: 10, color: "#888" }}>{d}</td>
                      <td style={{ padding: "3px 8px", fontSize: 11, color, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                        {v.toLocaleString("es-AR")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ padding: "4px 8px", fontSize: 9, color: "#333", borderTop: "1px solid #111" }}>
        Metodología: {data?.actual?.metodologia} · Comparativos regionales: estimaciones históricas EMBI+ (sin API de pago)
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function TabBonos() {
  const [activeTab, setActiveTab] = useState("soberanos")

  return (
    <div>
      <div className="bbg-panel-header">RENTA FIJA ARGENTINA — FASE 1</div>
      <SubTabs
        tabs={[
          { key: "soberanos", label: "Soberanos HD (AL/GD)" },
          { key: "lecaps", label: "LECAPs / BONCAPs" },
          { key: "riesgo", label: "Riesgo País" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />
      {activeTab === "soberanos" && <SoberanosScreener />}
      {activeTab === "lecaps" && <LecapsScreener />}
      {activeTab === "riesgo" && <RiesgoPaisView />}
    </div>
  )
}
