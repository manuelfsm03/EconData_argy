"use client"

/**
 * TabResumen — Panel de control rápido
 * Muestra los KPIs más críticos de un vistazo:
 *   tipos de cambio · brecha · inflación · riesgo país · reservas · badlar · noticias
 */

import { useState, useEffect } from "react"
import { useBCRAData } from "@/client/hooks/use-bcra-data"
import { InfoTooltip } from "@/client/components/ui/info-tooltip"
import { GLOSSARY } from "@/lib/glossary"

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
  if (v == null) return "var(--text-mute)"
  return v >= 0 ? "var(--positive)" : "var(--negative)"
}

function brechaColor(b: number): string {
  if (b < 15) return "var(--positive)"   // verde
  if (b < 40) return "#FFD700"   // amarillo
  if (b < 80) return "var(--amber)"   // naranja
  return "var(--negative)"               // rojo
}

function fmtTime(d: string): string {
  try { return new Date(d).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }
  catch { return "--:--" }
}

// ── KPI card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, unit, sub1, sub1Color, sub2, sub2Color, accent,
}: {
  label: string
  value: string
  unit?: string
  sub1?: string
  sub1Color?: string
  sub2?: string
  sub2Color?: string
  accent?: string
}) {
  return (
    <div style={{
      flex: "1 1 0",
      background: "var(--bg-elev)",
      border: "1px solid var(--border)",
      padding: "12px 16px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-data)", color: accent ?? "var(--amber)", lineHeight: 1 }}>
        {value}
      </div>
      {unit && <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>{unit}</div>}
      {sub1 && (
        <div style={{ fontSize: 11, color: sub1Color ?? "var(--text-dim)", marginTop: 6 }}>{sub1}</div>
      )}
      {sub2 && (
        <div style={{ fontSize: 11, color: sub2Color ?? "#666" }}>{sub2}</div>
      )}
    </div>
  )
}

// ── TC Strip ─────────────────────────────────────────────────────────────────

interface TCEntry {
  date: string
  blue?: number
  mep?: number
  ccl?: number
  oficial?: number
  mayorista?: number
}

const TC_LINES = [
  { key: "blue"      as keyof Omit<TCEntry,"date">, label: "Blue",      color: "var(--positive)" },
  { key: "ccl"       as keyof Omit<TCEntry,"date">, label: "CCL",       color: "var(--amber)" },
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
    <div style={{ padding: "20px 16px", color: "var(--text-dim)", fontSize: 11 }}>Cargando tipos de cambio...</div>
  )

  const latest = data[data.length - 1]
  const prev   = data[data.length - 2]

  const oficial = latest?.oficial
  const blue    = latest?.blue
  const ccl     = latest?.ccl

  const brechaBlue = blue && oficial && oficial > 0 ? ((blue - oficial) / oficial * 100) : null
  const brechaCCL  = ccl  && oficial && oficial > 0 ? ((ccl  - oficial) / oficial * 100) : null

  const goTC = () => onNavigate("macro", "fx")

  return (
    <div>
      {/* TC KPIs */}
      <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1 }}>
        {TC_LINES.map((l) => {
          const cur = latest?.[l.key]
          const prv = prev?.[l.key]
          const delta = cur != null && prv != null && prv > 0 ? ((cur - prv) / prv * 100) : null
          return (
            <div
              key={l.key}
              onClick={goTC}
              title="Ver en BCRA"
              style={{
                flex: "1 1 0",
                background: "var(--bg-elev)",
                border: "1px solid var(--border)",
                padding: "12px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center" }}>
                {l.label}
                {GLOSSARY[l.label.toUpperCase()] && (
                  <InfoTooltip text={GLOSSARY[l.label.toUpperCase()].text} source={GLOSSARY[l.label.toUpperCase()].source} url={GLOSSARY[l.label.toUpperCase()].url} position="bottom" />
                )}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-data)", color: l.color, lineHeight: 1 }}>
                {cur ? `$${fmt(cur)}` : "—"}
              </div>
              {delta != null && (
                <div style={{ fontSize: 11, color: varColor(delta), marginTop: 6 }}>
                  {pct(delta)} 1D
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Brecha */}
      <div style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1, marginTop: 1 }}>
        {[
          { label: "Brecha Blue / Oficial", value: brechaBlue },
          { label: "Brecha CCL / Oficial",  value: brechaCCL  },
        ].map((b) => (
          <div
            key={b.label}
            onClick={goTC}
            title="Ver en BCRA"
            style={{
              flex: "1 1 0",
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div>
              <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                {b.label}
              </div>
              <div style={{
                fontSize: 32,
                fontWeight: 900,
                fontFamily: "var(--font-data)",
                color: b.value != null ? brechaColor(b.value) : "var(--text-mute)",
                lineHeight: 1,
              }}>
                {b.value != null ? b.value.toFixed(1) + "%" : "—"}
              </div>
            </div>
            {b.value != null && (
              <div style={{
                width: 12, height: 12, borderRadius: "50%",
                background: brechaColor(b.value),
                boxShadow: `0 0 8px ${brechaColor(b.value)}88`,
                flexShrink: 0,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── IPC Block ─────────────────────────────────────────────────────────────────

function IPCBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const [mensual, setMensual]       = useState<number | null>(null)
  const [interanual, setInteranual] = useState<number | null>(null)
  const [periodo, setPeriodo]       = useState<string>("")
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    fetch("/api/macro?endpoint=ipc")
      .then((r) => r.json())
      .then((j) => {
        const vm: [string, number][] = j.data?.ipc_var_mensual ?? []
        const ia: [string, number][] = j.data?.ipc_var_interanual ?? []
        if (vm.length > 0) {
          // API returns desc order, first = latest
          setMensual(vm[0][1] * 100)
          setPeriodo(vm[0][0])
        }
        if (ia.length > 0) {
          setInteranual(ia[0][1])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const hoverStyle = (e: React.MouseEvent<HTMLDivElement>, enter: boolean) => {
    e.currentTarget.style.borderColor = enter ? "var(--border-hi)" : "var(--border)"
  }

  if (loading) return (
    <div style={{ flex: "1 1 0", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>INFLACIÓN</div>
      <div style={{ color: "var(--text-mute)", fontSize: 11, marginTop: 8 }}>Cargando...</div>
    </div>
  )

  return (
    <div
      onClick={() => onNavigate("macro", "ipc")}
      title="Ver IPC en Macro"
      onMouseEnter={(e) => hoverStyle(e, true)}
      onMouseLeave={(e) => hoverStyle(e, false)}
      style={{ flex: "1 1 0", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px", cursor: "pointer", transition: "border-color 0.15s" }}
    >
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 2 }}>
        IPC — {periodo || "inflación"}
        <InfoTooltip text={GLOSSARY["IPC"].text} source={GLOSSARY["IPC"].source} url={GLOSSARY["IPC"].url} position="bottom" />
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "var(--font-data)", color: "var(--negative)", lineHeight: 1 }}>
        {mensual != null ? mensual.toFixed(1) + "%" : "—"}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>variación mensual</div>
      {interanual != null && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Interanual</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-data)", color: "var(--negative)" }}>
            {interanual.toFixed(1)}%
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

  const color = bps == null ? "var(--text-mute)"
    : bps > 1500 ? "var(--negative)"
    : bps > 800  ? "var(--amber)"
    : bps > 400  ? "#FFD700"
    : "var(--positive)"

  if (loading) return (
    <div style={{ flex: "1 1 0", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>RIESGO PAÍS</div>
      <div style={{ color: "var(--text-mute)", fontSize: 11, marginTop: 8 }}>Cargando...</div>
    </div>
  )

  return (
    <div
      onClick={() => onNavigate("macro", "riesgo")}
      title="Ver Riesgo País en Macro"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      style={{ flex: "1 1 0", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px", cursor: "pointer", transition: "border-color 0.15s" }}
    >
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 2 }}>
        Riesgo País — EMBI+
        <InfoTooltip text={GLOSSARY["RIESGO PAÍS"].text} source={GLOSSARY["RIESGO PAÍS"].source} url={GLOSSARY["RIESGO PAÍS"].url} position="bottom" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "var(--font-data)", color, lineHeight: 1 }}>
          {bps != null ? fmt(bps) : "—"}
        </div>
        {bps != null && (
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: color, boxShadow: `0 0 8px ${color}88`, flexShrink: 0,
          }} />
        )}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>puntos básicos</div>
      <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
        {var1w != null && (
          <div>
            <div style={{ fontSize: 9, color: "var(--text-dim)" }}>Semanal</div>
            <div style={{ fontSize: 13, fontFamily: "var(--font-data)", color: varColor(-var1w) }}>
              {var1w > 0 ? "+" : ""}{fmt(var1w)} bps
            </div>
          </div>
        )}
        {var1m != null && (
          <div>
            <div style={{ fontSize: 9, color: "var(--text-dim)" }}>Mensual</div>
            <div style={{ fontSize: 13, fontFamily: "var(--font-data)", color: varColor(-var1m) }}>
              {var1m > 0 ? "+" : ""}{fmt(var1m)} bps
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reservas + Badlar Block ───────────────────────────────────────────────────

function ReservasBadlarBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const { data, loading } = useBCRAData(["reservas", "badlar"], "1m")

  const latest = data[data.length - 1]
  const prev   = data[data.length - 2]

  const reservas = latest?.reservas as number | undefined
  const badlar   = latest?.badlar   as number | undefined
  const resPrev  = prev?.reservas   as number | undefined
  const resDelta = reservas != null && resPrev != null ? reservas - resPrev : null

  if (loading) return (
    <div style={{ flex: "1 1 0", background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px" }}>
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>RESERVAS / BADLAR</div>
      <div style={{ color: "var(--text-mute)", fontSize: 11, marginTop: 8 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Reservas */}
      <div
        onClick={() => onNavigate("bcra", null, "reservas")}
        title="Ver Reservas en BCRA"
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        style={{ flex: 1, background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px", cursor: "pointer", transition: "border-color 0.15s" }}
      >
        <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 2 }}>
          Reservas BCRA
          <InfoTooltip text={GLOSSARY["RESERVAS"].text} source={GLOSSARY["RESERVAS"].source} url={GLOSSARY["RESERVAS"].url} position="bottom" />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-data)", color: "var(--positive)", lineHeight: 1 }}>
          {reservas != null ? `USD ${fmt(reservas / 1000, 1)}B` : "—"}
        </div>
        {resDelta != null && (
          <div style={{ fontSize: 11, color: varColor(resDelta), marginTop: 6 }}>
            {resDelta > 0 ? "+" : ""}{fmt(resDelta / 1000, 1)}B 1D
          </div>
        )}
      </div>
      {/* Badlar */}
      <div
        onClick={() => onNavigate("bcra", null, "plazofijo")}
        title="Ver Tasas en BCRA"
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hi)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        style={{ flex: 1, background: "var(--bg-elev)", border: "1px solid var(--border)", padding: "12px 16px", cursor: "pointer", transition: "border-color 0.15s" }}
      >
        <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 2 }}>
          Tasa BADLAR
          <InfoTooltip text={GLOSSARY["BADLAR"].text} source={GLOSSARY["BADLAR"].source} url={GLOSSARY["BADLAR"].url} position="bottom" />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-data)", color: "var(--amber)", lineHeight: 1 }}>
          {badlar != null ? badlar.toFixed(1) + "%" : "—"}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>tasa nominal anual</div>
      </div>
    </div>
  )
}

// ── Headlines Block ───────────────────────────────────────────────────────────

interface RSSItem {
  id: string
  title: string
  link: string
  source: string
  pubDate: string
  category: string
}

const CAT_COLORS: Record<string, string> = {
  economía:    "var(--sky)",
  finanzas:    "var(--yellow)",
  política:    "#ce93d8",
  comercio:    "#4488ff",
  energía:     "#ffaa00",
  commodities: "#81c784",
}

function HeadlinesBlock({ onNavigate }: { onNavigate: NavigateFn }) {
  const [items, setItems]   = useState<RSSItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/rss-news")
      .then((r) => r.json())
      .then((j: RSSItem[]) => { setItems(j.slice(0, 6)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
      <div
        onClick={() => onNavigate("noticias", null)}
        title="Ver todas las noticias"
        style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>Últimas noticias</span>
        <span style={{ color: "var(--text-mute)", fontSize: 9 }}>Ver todas →</span>
      </div>
      {loading && (
        <div style={{ padding: "16px", color: "var(--text-mute)", fontSize: 11 }}>Cargando...</div>
      )}
      {items.map((item, i) => {
        const catColor = CAT_COLORS[item.category] ?? "var(--text-mute)"
        return (
          <div key={item.id + i} style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            padding: "10px 16px",
            borderBottom: "1px solid var(--bg-elev-2)",
            background: i % 2 === 0 ? "var(--bg)" : "var(--bg)",
          }}>
            <span style={{ fontSize: 10, color: "var(--amber)", fontFamily: "var(--font-data)", flexShrink: 0 }}>
              {fmtTime(item.pubDate)}
            </span>
            <span style={{
              fontSize: 9, fontFamily: "var(--font-data)", fontWeight: 700,
              textTransform: "uppercase", color: catColor,
              border: `1px solid ${catColor}44`, borderRadius: 10,
              padding: "1px 6px", flexShrink: 0,
            }}>
              {item.category || item.source.slice(0, 8)}
            </span>
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: "#ddd", textDecoration: "none", lineHeight: 1.4 }}
            >
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

      {/* Fila 1: Tipos de cambio + Brecha */}
      <section>
        <div style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
          Tipos de cambio
        </div>
        <TCStrip onNavigate={onNavigate} />
      </section>

      {/* Fila 2: IPC + Riesgo País + Reservas/Badlar */}
      <section style={{ display: "flex", gap: 1, background: "var(--bg-elev-2)", padding: 1 }}>
        <IPCBlock onNavigate={onNavigate} />
        <RiesgoPaisBlock onNavigate={onNavigate} />
        <ReservasBadlarBlock onNavigate={onNavigate} />
      </section>

      {/* Fila 3: Headlines */}
      <section>
        <HeadlinesBlock onNavigate={onNavigate} />
      </section>

    </div>
  )
}
