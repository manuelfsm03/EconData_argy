"use client"

import { useState, useEffect } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type MetricaId = "empleo" | "salarios" | "fiscal" | "bancario_dep" | "bancario_prest" | "establecimientos"

interface MetricaConfig {
  label: string
  endpoint: string
  campo: string
  formato: (v: number) => string
  unidad: string
  descripcion: string
  colorBaja: string
  colorAlta: string
  invertir?: boolean
}

const METRICAS: Record<MetricaId, MetricaConfig> = {
  empleo: {
    label: "Empleo",
    endpoint: "/api/provincias/empleo",
    campo: "ultimo_valor",
    formato: (v) => v.toLocaleString("es-AR"),
    unidad: "puestos priv. reg.",
    descripcion: "Puestos de trabajo privados registrados — OEDE/SIPA-AFIP",
    colorBaja: "#1a2a1a",
    colorAlta: "#00e676",
  },
  salarios: {
    label: "Salarios",
    endpoint: "/api/provincias/salarios",
    campo: "salario",
    formato: (v) => "$" + Math.round(v / 1000).toLocaleString("es-AR") + "k",
    unidad: "salario prom. privado",
    descripcion: "Salario promedio mensual sector privado registrado — OEDE/SIPA-AFIP",
    colorBaja: "#1a1a2a",
    colorAlta: "#448aff",
  },
  fiscal: {
    label: "Fiscal",
    endpoint: "/api/provincias/fiscal",
    campo: "resultado_financiero",
    formato: (v) => (v >= 0 ? "+" : "") + v.toLocaleString("es-AR", { maximumFractionDigits: 0 }),
    unidad: "resultado financiero (MM$)",
    descripcion: "Resultado financiero provincial acumulado anual — Sec. Hacienda",
    colorBaja: "#2a1010",
    colorAlta: "#69f0ae",
    invertir: false,
  },
  bancario_dep: {
    label: "Depósitos",
    endpoint: "/api/provincias/bancario",
    campo: "depositos_privados_ars",
    formato: (v) => v.toFixed(2) + "%",
    unidad: "% del total nacional",
    descripcion: "Participación en depósitos privados en ARS — BCRA (trimestral)",
    colorBaja: "#1a1a2a",
    colorAlta: "#b388ff",
  },
  bancario_prest: {
    label: "Préstamos",
    endpoint: "/api/provincias/bancario",
    campo: "prestamos_privados_ars",
    formato: (v) => v.toFixed(2) + "%",
    unidad: "% del total nacional",
    descripcion: "Participación en préstamos privados en ARS — BCRA (trimestral)",
    colorBaja: "#1a1a2a",
    colorAlta: "#ff8a65",
  },
  establecimientos: {
    label: "Empresas",
    endpoint: "/api/provincias/establecimientos",
    campo: "ultimo_valor",
    formato: (v) => v.toLocaleString("es-AR"),
    unidad: "establecimientos únicos",
    descripcion: "Establecimientos productivos únicos (CUIT) — CEP XXI / Sec. Industria",
    colorBaja: "#1a2a20",
    colorAlta: "#40c4ff",
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a: string, b: string, t: number): string {
  const hex = (s: string) => [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ]
  const ca = hex(a), cb = hex(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const bv = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `rgb(${r},${g},${bv})`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProvinciasRanking() {
  const [metrica, setMetrica] = useState<MetricaId>("empleo")
  const [data, setData] = useState<{ id: string; nombre: string; valor: number | null; ultimo_periodo?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [cache, setCache] = useState<Partial<Record<MetricaId, typeof data>>>({})

  const cfg = METRICAS[metrica]

  useEffect(() => {
    if (cache[metrica]) {
      setData(cache[metrica]!)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    fetch(cfg.endpoint)
      .then(r => r.json())
      .then(json => {
        const rows = (json.data ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          nombre: p.nombre as string,
          valor: (p[cfg.campo] as number) ?? null,
          ultimo_periodo: (p.ultimo_periodo ?? p.ultimo_anio) as string | undefined,
        }))
        setCache(prev => ({ ...prev, [metrica]: rows }))
        setData(rows)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [metrica])

  const sorted = [...data]
    .filter(r => r.valor != null)
    .sort((a, b) => sortAsc ? (a.valor! - b.valor!) : (b.valor! - a.valor!))

  const maxVal = sorted.length ? Math.max(...sorted.map(r => Math.abs(r.valor!))) : 1
  const minVal = Math.min(...sorted.map(r => r.valor ?? 0))

  const ultimoPeriodo = sorted[0]?.ultimo_periodo

  return (
    <div style={{ fontFamily: "var(--font-data)", fontSize: 11 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: 0.5 }}>
            ECONOMÍAS PROVINCIALES
          </div>
          <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>
            {cfg.descripcion}
            {ultimoPeriodo && <span style={{ color: "var(--amber)", marginLeft: 6 }}>· {ultimoPeriodo}</span>}
          </div>
        </div>
        <button
          onClick={() => setSortAsc(s => !s)}
          style={{
            background: "var(--bg-elev)", border: "1px solid var(--border)",
            color: "var(--text-dim)", fontSize: 9, padding: "3px 8px", cursor: "pointer",
          }}
        >
          {sortAsc ? "↑ MENOR" : "↓ MAYOR"}
        </button>
      </div>

      {/* Selector de métrica */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {(Object.keys(METRICAS) as MetricaId[]).map(m => (
          <button
            key={m}
            onClick={() => setMetrica(m)}
            style={{
              padding: "3px 10px",
              fontSize: 9,
              fontWeight: metrica === m ? 700 : 400,
              background: metrica === m ? "var(--amber)" : "var(--bg-elev)",
              color: metrica === m ? "#000" : "var(--text-dim)",
              border: "1px solid " + (metrica === m ? "var(--amber)" : "var(--border)"),
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {METRICAS[m].label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {loading && (
        <div style={{ color: "var(--text-dim)", padding: "20px 0", textAlign: "center" }}>Cargando datos...</div>
      )}
      {error && (
        <div style={{ color: "var(--negative)", padding: "10px 0" }}>Error: {error}</div>
      )}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sorted.map((prov, i) => {
            const absVal = Math.abs(prov.valor!)
            const barPct = Math.abs(prov.valor!) / maxVal
            // Para resultado financiero: rojo si negativo, verde si positivo
            const isNeg = prov.valor! < 0
            const barColor = metrica === "fiscal"
              ? (isNeg ? "#f44336" : "#69f0ae")
              : lerp(cfg.colorBaja, cfg.colorAlta, barPct)

            return (
              <div
                key={prov.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                  borderBottom: "1px solid var(--bg-elev)",
                }}
              >
                {/* Rank */}
                <div style={{ width: 18, textAlign: "right", color: "var(--text-dim)", fontSize: 9, flexShrink: 0 }}>
                  {i + 1}
                </div>
                {/* Province name */}
                <div style={{ width: 120, color: "var(--text)", fontSize: 10, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {prov.nombre}
                </div>
                {/* Bar */}
                <div style={{ flex: 1, position: "relative", height: 14, background: "var(--bg-elev)" }}>
                  <div
                    style={{
                      position: "absolute",
                      top: 0, bottom: 0,
                      left: metrica === "fiscal" && isNeg ? `${(1 - barPct) * 50}%` : 0,
                      width: metrica === "fiscal" ? `${barPct * 50}%` : `${barPct * 100}%`,
                      background: barColor,
                      opacity: 0.85,
                      transition: "width 0.3s ease, left 0.3s ease",
                    }}
                  />
                </div>
                {/* Value */}
                <div style={{ width: 80, textAlign: "right", color: isNeg ? "var(--negative)" : "var(--amber)", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                  {cfg.formato(prov.valor!)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 8, fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev)", paddingTop: 4 }}>
        {cfg.unidad} · Fuente: {cfg.descripcion.split("—")[1]?.trim()}
      </div>
    </div>
  )
}
