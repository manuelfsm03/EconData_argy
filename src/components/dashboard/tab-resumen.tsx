"use client"

/**
 * TabResumen — Panel de control rápido
 * KPIs + mini charts para análisis económico rápido:
 *   tipos de cambio · brecha · IPC · riesgo país · reservas · badlar · breakeven · noticias
 */

import { useState, useEffect } from "react"
import { useBCRAData } from "@/hooks/use-bcra-data"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 0): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function pct(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—"
  return (v >= 0 ? "+" : "") + v.toFixed(dec) + "%"
}

function varColor(v: number | null | undefined): string {
  if (v == null) return "#555"
  return v >= 0 ? "#4AF6C3" : "#FF433D"
}

function brechaColor(b: number): string {
  if (b < 15) return "#4AF6C3"
  if (b < 40) return "#FFD700"
  if (b < 80) return "#FFA028"
  return "#FF433D"
}

function fmtTime(d: string): string {
  try { return new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }
  catch { return "--:--" }
}

function fmtDateShort(d: string): string {
  try {
    const date = new Date(d + "T00:00:00")
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`
  } catch { return d.slice(5) }
}

const TOOLTIP_STYLE = { background: "#0a0a0a", border: "1px solid #222", fontSize: 9, fontFamily: "monospace" }

// ── TC Strip + Chart ──────────────────────────────────────────────────────────

interface TCEntry {
  date: string
  blue?: number
  mep?: number
  ccl?: number
  oficial?: number
  mayorista?: number
}

const TC_LINES = [
  { key: "blue"      as keyof Omit<TCEntry,"date">, label: "Blue",      color: "#4AF6C3" },
  { key: "ccl"       as keyof Omit<TCEntry,"date">, label: "CCL",       color: "#FFA028" },
  { key: "mep"       as keyof Omit<TCEntry,"date">, label: "MEP",       color: "#FFD700" },
  { key: "mayorista" as keyof Omit<TCEntry,"date">, label: "Mayorista", color: "#888888" },
  { key: "oficial"   as keyof Omit<TCEntry,"date">, label: "Oficial",   color: "#aaaaaa" },
]

type NavigateFn = (tab: string, subtab?: string | null, bcra?: string | null) => void

function TCStrip({ onNavigate }: { onNavigate: NavigateFn }) {
  const [data, setData] = useState<TCEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tc-historico?period=1m")
      .then((r) => r.json())
      .then((j) => { setData(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: "20px 16px", color: "#555", fontSize: 11 }}>Cargando tipos de cambio...</div>
  )

  const latest = data[data.length - 1]
  const prev   = data[data.length - 2]
  const oficial = latest?.oficial
  const blue    = latest?.blue
  const ccl     = latest?.ccl

  const brechaBlue = blue && oficial && oficial > 0 ? ((blue - oficial) / oficial * 100) : null
  const brechaCCL  = ccl  && oficial && oficial > 0 ? ((ccl  - oficial) / oficial * 100) : null

  const goTC = () => onNavigate("macro", "fx")

  // Chart data: keep every 2nd point to avoid clutter on small chart
  const chartData = data
    .filter((_, i) => i % 2 === 0 || i === data.length - 1)
    .map(d => ({ date: fmtDateShort(d.date), blue: d.blue, ccl: d.ccl, oficial: d.oficial }))

  return (
    <div>
      {/* TC KPIs */}
      <div style={{ display: "flex", gap: 1, background: "#111", padding: 1 }}>
        {TC_LINES.map((l) => {
          const cur = latest?.[l.key]
          const prv = prev?.[l.key]
          const delta = cur != null && prv != null && prv > 0 ? ((cur - prv) / prv * 100) : null
          return (
            <div key={l.key} onClick={goTC} title="Ver en BCRA" style={{
              flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a",
              padding: "10px 14px", cursor: "pointer", transition: "border-color 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
            >
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{l.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: l.color, lineHeight: 1 }}>
                {cur ? `$${fmt(cur)}` : "—"}
              </div>
              {delta != null && (
                <div style={{ fontSize: 10, color: varColor(delta), marginTop: 4 }}>{pct(delta)} 1D</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Brecha */}
      <div style={{ display: "flex", gap: 1, background: "#111", padding: 1, marginTop: 1 }}>
        {[
          { label: "Brecha Blue / Oficial", value: brechaBlue },
          { label: "Brecha CCL / Oficial",  value: brechaCCL  },
        ].map((b) => (
          <div key={b.label} onClick={goTC} title="Ver en BCRA" style={{
            flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a",
            padding: "10px 16px", display: "flex", alignItems: "center", gap: 16,
            cursor: "pointer", transition: "border-color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
          >
            <div>
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{b.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: b.value != null ? brechaColor(b.value) : "#555", lineHeight: 1 }}>
                {b.value != null ? b.value.toFixed(1) + "%" : "—"}
              </div>
            </div>
            {b.value != null && (
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: brechaColor(b.value), boxShadow: `0 0 8px ${brechaColor(b.value)}88`, flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* TC Chart */}
      {chartData.length > 2 && (
        <div style={{ background: "#050505", border: "1px solid #111", borderTop: "none", padding: "10px 12px 8px" }}>
          <div style={{ fontSize: 8, color: "#333", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
            EVOLUCIÓN 30D — ARS/USD
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={chartData} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#0d0d0d" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: "#333", fontSize: 8 }} axisLine={false} tickLine={false}
                interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fill: "#333", fontSize: 8 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `$${fmt(v)}`} width={52} domain={["auto", "auto"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(v: unknown, name: unknown) => [`$${fmt(Number(v))}`, String(name)]}
                labelFormatter={(l: unknown) => `${l}`} />
              <Line type="monotone" dataKey="blue"    name="Blue"    stroke="#4AF6C3" strokeWidth={1.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="ccl"     name="CCL"     stroke="#FFA028" strokeWidth={1.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="oficial" name="Oficial" stroke="#555"    strokeWidth={1}   dot={false} connectNulls strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── IPC Block con BarChart ────────────────────────────────────────────────────

interface IPCBar { label: string; valor: number }

function IPCBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const [mensual, setMensual]       = useState<number | null>(null)
  const [interanual, setInteranual] = useState<number | null>(null)
  const [periodo, setPeriodo]       = useState<string>("")
  const [bars, setBars]             = useState<IPCBar[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    fetch("/api/macro?endpoint=ipc")
      .then((r) => r.json())
      .then((j) => {
        const vm: [string, number][] = j.data?.ipc_var_mensual ?? []
        const ia: [string, number][] = j.data?.ipc_var_interanual ?? []
        if (vm.length > 0) {
          setMensual(vm[0][1] * 100)
          setPeriodo(vm[0][0])
        }
        if (ia.length > 0) setInteranual(ia[0][1])

        // Barras: últimos 12 meses (datos vienen desc, reversamos)
        const last12 = vm.slice(0, 12).reverse()
        setBars(last12.map(([fecha, val]) => {
          const d = new Date(fecha + "-01")
          const label = d.toLocaleDateString("es-AR", { month: "short" }).slice(0, 3).toUpperCase()
          return { label, valor: parseFloat((val * 100).toFixed(1)) }
        }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>INFLACIÓN</div>
      <div style={{ color: "#333", fontSize: 11, marginTop: 8 }}>Cargando...</div>
    </div>
  )

  return (
    <div
      onClick={() => onNavigate("macro", "ipc")}
      title="Ver IPC en Macro"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
      style={{ flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 14px 8px", cursor: "pointer", transition: "border-color 0.15s", minWidth: 0 }}
    >
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        IPC — {periodo || "inflación"}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: "#FF433D", lineHeight: 1 }}>
            {mensual != null ? mensual.toFixed(1) + "%" : "—"}
          </div>
          <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>mensual</div>
        </div>
        {interanual != null && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#FF433D99" }}>
              {interanual.toFixed(1)}%
            </div>
            <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>interanual</div>
          </div>
        )}
      </div>

      {bars.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={bars} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#333", fontSize: 7 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, "IPC mensual"]}
                cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="valor" fill="#FF433D" radius={[2, 2, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 7, color: "#222", textAlign: "center", marginTop: 2, fontFamily: "monospace" }}>
            Últimos 12 meses · INDEC
          </div>
        </div>
      )}
    </div>
  )
}

// ── Riesgo País Block ─────────────────────────────────────────────────────────

function RiesgoPaisBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const [bps, setBps]       = useState<number | null>(null)
  const [var1w, setVar1w]   = useState<number | null>(null)
  const [var1m, setVar1m]   = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/riesgo-pais")
      .then((r) => r.json())
      .then((j) => {
        const actual = j.data?.actual
        setBps(actual?.riesgoPaisBps ?? null)
        setVar1w(actual?.var1w ?? null)
        setVar1m(actual?.var1m ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const color = bps == null ? "#555"
    : bps > 1500 ? "#FF433D"
    : bps > 800  ? "#FFA028"
    : bps > 400  ? "#FFD700"
    : "#4AF6C3"

  if (loading) return (
    <div style={{ flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>RIESGO PAÍS</div>
      <div style={{ color: "#333", fontSize: 11, marginTop: 8 }}>Cargando...</div>
    </div>
  )

  // Gauge visual based on bps level
  const levels = [
    { label: "< 400", color: "#4AF6C3", active: bps != null && bps < 400 },
    { label: "400-800", color: "#FFD700", active: bps != null && bps >= 400 && bps < 800 },
    { label: "800-1500", color: "#FFA028", active: bps != null && bps >= 800 && bps < 1500 },
    { label: "> 1500", color: "#FF433D", active: bps != null && bps >= 1500 },
  ]

  return (
    <div
      onClick={() => onNavigate("macro", "riesgo")}
      title="Ver Riesgo País en Macro"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
      style={{ flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 14px", cursor: "pointer", transition: "border-color 0.15s", minWidth: 0 }}
    >
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        Riesgo País — EMBI+
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color, lineHeight: 1 }}>
          {bps != null ? fmt(bps) : "—"}
        </div>
        {bps != null && (
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}88`, flexShrink: 0 }} />
        )}
      </div>
      <div style={{ fontSize: 9, color: "#444", marginBottom: 12 }}>puntos básicos</div>

      {/* Gauge bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
        {levels.map(l => (
          <div key={l.label} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: l.active ? l.color : "#111",
            boxShadow: l.active ? `0 0 6px ${l.color}88` : "none",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {var1w != null && (
          <div>
            <div style={{ fontSize: 8, color: "#444" }}>Semanal</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: varColor(-var1w), fontWeight: 700 }}>
              {var1w > 0 ? "+" : ""}{fmt(var1w)} bps
            </div>
          </div>
        )}
        {var1m != null && (
          <div>
            <div style={{ fontSize: 8, color: "#444" }}>Mensual</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: varColor(-var1m), fontWeight: 700 }}>
              {var1m > 0 ? "+" : ""}{fmt(var1m)} bps
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reservas Block con sparkline ──────────────────────────────────────────────

function ReservasBadlarBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const { data, loading } = useBCRAData(["reservas", "badlar"], "3m")

  const latest = data[data.length - 1]
  const prev   = data[data.length - 2]

  const reservas = latest?.reservas as number | undefined
  const badlar   = latest?.badlar   as number | undefined
  const resPrev  = prev?.reservas   as number | undefined
  const resDelta = reservas != null && resPrev != null ? reservas - resPrev : null

  // Sparkline data for reservas (every 3rd point to reduce density)
  const sparkData = data
    .filter((_, i) => i % 3 === 0 || i === data.length - 1)
    .map(d => ({ date: String(d.date).slice(5), reservas: d.reservas as number }))

  if (loading) return (
    <div style={{ flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>RESERVAS / BADLAR</div>
      <div style={{ color: "#333", fontSize: 11, marginTop: 8 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      {/* Reservas */}
      <div
        onClick={() => onNavigate("bcra", null, "reservas")}
        title="Ver Reservas en BCRA"
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
        style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px 8px", cursor: "pointer", transition: "border-color 0.15s" }}
      >
        <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Reservas BCRA
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "#4AF6C3", lineHeight: 1 }}>
          {reservas != null ? `USD ${fmt(reservas / 1000, 1)}B` : "—"}
        </div>
        {resDelta != null && (
          <div style={{ fontSize: 10, color: varColor(resDelta), marginTop: 4 }}>
            {resDelta > 0 ? "+" : ""}{fmt(resDelta / 1000, 1)}B 1D
          </div>
        )}
        {sparkData.length > 3 && (
          <div style={{ marginTop: 8 }}>
            <ResponsiveContainer width="100%" height={55}>
              <LineChart data={sparkData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                <YAxis hide domain={["auto", "auto"]} />
                <XAxis dataKey="date" hide />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v: unknown) => [`USD ${fmt(Number(v) / 1000, 1)}B`, "Reservas"]}
                  labelFormatter={(l: unknown) => String(l)} />
                <Line type="monotone" dataKey="reservas" stroke="#4AF6C3" strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Badlar */}
      <div
        onClick={() => onNavigate("bcra", null, "plazofijo")}
        title="Ver Tasas en BCRA"
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
        style={{ flex: 1, background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "10px 14px", cursor: "pointer", transition: "border-color 0.15s" }}
      >
        <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Tasa BADLAR
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "#FFA028", lineHeight: 1 }}>
          {badlar != null ? badlar.toFixed(1) + "%" : "—"}
        </div>
        <div style={{ fontSize: 9, color: "#444", marginTop: 3 }}>tasa nominal anual</div>
      </div>
    </div>
  )
}

// ── Breakeven Mini Row ────────────────────────────────────────────────────────

interface BreakevenKPIs {
  lecap_corto_tea: number | null
  real_vs_rem:     number | null
  rem_inf12:       number | null
  rem_fecha:       string | null
  lecap_ticker:    string | null
}

function BreakevenRow({ onNavigate }: { onNavigate: NavigateFn }) {
  const [kpis, setKpis]   = useState<BreakevenKPIs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/breakeven")
      .then(r => r.json())
      .then(j => {
        const bk  = j?.data?.breakeven
        const rem = j?.data?.rem
        const ref = j?.data?.lecap_referencia
        setKpis({
          lecap_corto_tea: bk?.lecap_corto_tea ?? null,
          real_vs_rem:     bk?.real_vs_rem ?? null,
          rem_inf12:       rem?.inflacion_12m ?? null,
          rem_fecha:       rem?.fecha ?? null,
          lecap_ticker:    ref?.ticker ?? null,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const goBreakeven = () => onNavigate("macro", "breakeven")

  if (loading) return (
    <div style={{ display: "flex", gap: 1, background: "#111", padding: 1 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "12px 16px", minWidth: 0 }}>
          <div style={{ fontSize: 9, color: "#333" }}>Cargando...</div>
        </div>
      ))}
    </div>
  )

  const realColor = kpis?.real_vs_rem == null ? "#555"
    : kpis.real_vs_rem > 5  ? "#4AF6C3"
    : kpis.real_vs_rem > 0  ? "#FFD700"
    : "#FF433D"

  const cards = [
    {
      label: "LECAP TEA",
      sub: kpis?.lecap_ticker ?? "tasa fija",
      value: kpis?.lecap_corto_tea != null ? kpis.lecap_corto_tea.toFixed(1) + "%" : "—",
      color: "#FFA028",
    },
    {
      label: "REM — Inflación 12M",
      sub: kpis?.rem_fecha ?? "expectativas mercado",
      value: kpis?.rem_inf12 != null ? kpis.rem_inf12.toFixed(1) + "%" : "—",
      color: "#FF433D",
    },
    {
      label: "Tasa Real Implícita",
      sub: kpis?.real_vs_rem != null
        ? kpis.real_vs_rem > 5 ? "Positiva — LECAP > Inflación esperada"
        : kpis.real_vs_rem > 0 ? "Levemente positiva"
        : "Negativa — inflación > LECAP"
        : "LECAP vs REM",
      value: kpis?.real_vs_rem != null ? (kpis.real_vs_rem > 0 ? "+" : "") + kpis.real_vs_rem.toFixed(1) + "%" : "—",
      color: realColor,
    },
  ]

  return (
    <div style={{ display: "flex", gap: 1, background: "#111", padding: 1 }}>
      {cards.map((c) => (
        <div key={c.label} onClick={goBreakeven} title="Ver Breakeven en Macro" style={{
          flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a",
          padding: "12px 16px", cursor: "pointer", transition: "border-color 0.15s", minWidth: 0,
        }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#333")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
        >
          <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "monospace", color: c.color, lineHeight: 1 }}>{c.value}</div>
          <div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Headlines Block ───────────────────────────────────────────────────────────

interface RSSItem {
  id: string; title: string; link: string; source: string; pubDate: string; category: string
}

const CAT_COLORS: Record<string, string> = {
  economía:    "#4FC3F7",
  finanzas:    "#FFD54F",
  política:    "#ce93d8",
  comercio:    "#4488ff",
  energía:     "#ffaa00",
  commodities: "#81c784",
}

// ── Últimas Licitaciones ──────────────────────────────────────────────────────

interface Licitacion {
  fecha: string
  adjudicado_bn: number | null
  vencimientos_bn: number | null
  rollover_pct: number | null
  instrumentos: { tipo: string; tem: number }[]
  url: string
}

function rolloverColor(r: number | null): string {
  if (r == null) return "#555"
  if (r >= 120) return "#4AF6C3"
  if (r >= 100) return "#FFD700"
  return "#FF433D"
}

function LicitacionesBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const [licit, setLicit]     = useState<Licitacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/deuda?n=4")
      .then(r => r.json())
      .then(j => { setLicit(j.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ flex: "1 1 0", background: "#0a0a0a", border: "1px solid #1a1a1a", minWidth: 0 }}>
      <div
        onClick={() => onNavigate("macro", "deuda")}
        title="Ver Deuda en Macro"
        style={{ padding: "8px 14px", borderBottom: "1px solid #111", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#888")}
        onMouseLeave={e => (e.currentTarget.style.color = "#555")}
      >
        <span>Últimas licitaciones</span>
        <span style={{ color: "#333", fontSize: 9 }}>Ver detalle →</span>
      </div>
      {loading && <div style={{ padding: 16, color: "#333", fontSize: 10, fontFamily: "monospace" }}>Cargando...</div>}
      {licit.map((l, i) => {
        const rc = rolloverColor(l.rollover_pct)
        return (
          <div key={i} style={{
            padding: "10px 14px",
            borderBottom: "1px solid #0d0d0d",
            background: i % 2 === 0 ? "#000" : "#060606",
          }}>
            {/* Fila principal */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: "#FFA028", fontFamily: "monospace" }}>{l.fecha}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {l.adjudicado_bn != null && (
                  <span style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace" }}>
                    ${l.adjudicado_bn.toLocaleString("es-AR")}M adj.
                  </span>
                )}
                {l.rollover_pct != null && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, fontFamily: "monospace", color: rc,
                    background: rc + "18", padding: "1px 7px", borderRadius: 3,
                  }}>
                    {l.rollover_pct.toFixed(1)}% rollover
                  </span>
                )}
              </div>
            </div>
            {/* Instrumentos */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {l.instrumentos.slice(0, 5).map((ins, j) => (
                <span key={j} style={{
                  fontSize: 8, fontFamily: "monospace", color: "#666",
                  border: "1px solid #1e1e1e", borderRadius: 3, padding: "1px 6px",
                }}>
                  {ins.tipo}{ins.tem > 0 ? ` ${ins.tem.toFixed(2)}% TEM` : ""}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Top Ganadores y Perdedores ────────────────────────────────────────────────

interface StockRow {
  ticker: string
  lastPrice: number | null
  change1D: number | null
}

function GanadoresPerdedoresBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const [winners, setWinners] = useState<StockRow[]>([])
  const [losers, setLosers]   = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/acciones?tape=1")
      .then(r => r.json())
      .then(j => {
        const data: StockRow[] = (j.data ?? []).filter((s: StockRow) => s.change1D != null)
        const sorted = [...data].sort((a, b) => (b.change1D ?? 0) - (a.change1D ?? 0))
        setWinners(sorted.slice(0, 5))
        setLosers(sorted.slice(-5).reverse())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const Row = ({ s, isWinner }: { s: StockRow; isWinner: boolean }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 14px", borderBottom: "1px solid #0a0a0a",
    }}>
      <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color: "#ccc", minWidth: 52 }}>
        {s.ticker}
      </span>
      {s.lastPrice != null && (
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#555" }}>
          ${s.lastPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}
      <span style={{
        fontSize: 12, fontWeight: 800, fontFamily: "monospace",
        color: isWinner ? "#4AF6C3" : "#FF433D",
        minWidth: 60, textAlign: "right",
      }}>
        {s.change1D != null ? (s.change1D >= 0 ? "+" : "") + s.change1D.toFixed(2) + "%" : "—"}
      </span>
    </div>
  )

  return (
    <div style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      {/* Ganadores */}
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", flex: 1 }}>
        <div
          onClick={() => onNavigate("finanzas")}
          style={{ padding: "8px 14px", borderBottom: "1px solid #111", fontSize: 9, color: "#4AF6C344", textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#4AF6C3")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4AF6C344")}
        >
          <span>▲ Top ganadores</span>
          <span style={{ color: "#1e1e1e" }}>Merval 1D</span>
        </div>
        {loading
          ? <div style={{ padding: 12, color: "#333", fontSize: 10, fontFamily: "monospace" }}>Cargando...</div>
          : winners.map(s => <Row key={s.ticker} s={s} isWinner />)
        }
      </div>
      {/* Perdedores */}
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", flex: 1 }}>
        <div
          onClick={() => onNavigate("finanzas")}
          style={{ padding: "8px 14px", borderBottom: "1px solid #111", fontSize: 9, color: "#FF433D44", textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#FF433D")}
          onMouseLeave={e => (e.currentTarget.style.color = "#FF433D44")}
        >
          <span>▼ Top perdedores</span>
          <span style={{ color: "#1e1e1e" }}>Merval 1D</span>
        </div>
        {loading
          ? <div style={{ padding: 12, color: "#333", fontSize: 10, fontFamily: "monospace" }}>Cargando...</div>
          : losers.map(s => <Row key={s.ticker} s={s} isWinner={false} />)
        }
      </div>
    </div>
  )
}

// ── Headlines Block ───────────────────────────────────────────────────────────

function HeadlinesBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const [items, setItems]     = useState<RSSItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/rss-news")
      .then((r) => r.json())
      .then((j: RSSItem[]) => { setItems(j.slice(0, 6)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
      <div
        onClick={() => onNavigate("noticias", null)}
        title="Ver todas las noticias"
        style={{ padding: "8px 16px", borderBottom: "1px solid #1a1a1a", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>Últimas noticias</span>
        <span style={{ color: "#333", fontSize: 9 }}>Ver todas →</span>
      </div>
      {loading && <div style={{ padding: "16px", color: "#333", fontSize: 11 }}>Cargando...</div>}
      {items.map((item, i) => {
        const catColor = CAT_COLORS[item.category] ?? "#555"
        return (
          <div key={item.id + i} style={{
            display: "flex", alignItems: "baseline", gap: 10,
            padding: "10px 16px", borderBottom: "1px solid #0d0d0d",
            background: i % 2 === 0 ? "#000" : "#060606",
          }}>
            <span style={{ fontSize: 10, color: "#FFA028", fontFamily: "monospace", flexShrink: 0 }}>
              {fmtTime(item.pubDate)}
            </span>
            <span style={{
              fontSize: 9, fontFamily: "monospace", fontWeight: 700, textTransform: "uppercase", color: catColor,
              border: `1px solid ${catColor}44`, borderRadius: 10, padding: "1px 6px", flexShrink: 0,
            }}>
              {item.category || item.source.slice(0, 8)}
            </span>
            <a href={item.link} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: "#ddd", textDecoration: "none", lineHeight: 1.4 }}>
              {item.title}
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function TabResumen({ onNavigate }: { onNavigate: NavigateFn }) {
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12, maxWidth: 1400 }}>

      {/* Fila 1: Tipos de cambio + Chart */}
      <section>
        <div style={{ fontSize: 9, color: "#333", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
          Tipos de cambio
        </div>
        <TCStrip onNavigate={onNavigate} />
      </section>

      {/* Fila 2: IPC + Riesgo País + Reservas/Badlar */}
      <section style={{ display: "flex", gap: 1, background: "#111", padding: 1 }}>
        <IPCBlock onNavigate={onNavigate} />
        <RiesgoPaisBlock onNavigate={onNavigate} />
        <ReservasBadlarBlock onNavigate={onNavigate} />
      </section>

      {/* Fila 3: Breakeven */}
      <section>
        <div style={{ fontSize: 9, color: "#333", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
          Breakeven · Tasa real implícita
        </div>
        <BreakevenRow onNavigate={onNavigate} />
      </section>

      {/* Fila 4: Licitaciones + Ganadores/Perdedores */}
      <section style={{ display: "flex", gap: 1, alignItems: "stretch" }}>
        <LicitacionesBlock onNavigate={onNavigate} />
        <GanadoresPerdedoresBlock onNavigate={onNavigate} />
      </section>

      {/* Fila 5: Headlines */}
      <section>
        <HeadlinesBlock onNavigate={onNavigate} />
      </section>

    </div>
  )
}
