/**
 * TabDeuda — Licitaciones de deuda del Tesoro + Resultado Fiscal
 *
 * API: /api/deuda (licitaciones scrapeadas de argentina.gob.ar)
 *      /api/macro?endpoint=fiscal (INDEC via datos.gob.ar)
 *
 * Portado de EconData_argy/js/components/sections/economia/SeccionDeuda.js
 */

"use client"

import { useState, useEffect, useCallback } from "react"

interface Instrumento {
  tipo: string
  tem: number
}

interface Licitacion {
  fecha: string
  adjudicado_bn: number | null
  vencimientos_bn: number | null
  rollover_pct: number | null
  instrumentos: Instrumento[]
  url: string
}

function fmtMonto(v: number | null | undefined): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR")
}

function RolloverBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span style={{ color: "#555" }}>—</span>
  const color = pct >= 100 ? "#4AF6C3" : "#FF433D"
  return (
    <span style={{ color, fontFamily: "monospace", fontWeight: 700 }}>
      {pct.toFixed(1)}%
    </span>
  )
}

export function TabDeuda() {
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/deuda?n=6")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      setLicitaciones(j.data ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const ultima = licitaciones[0]
  const rolloverPromedio =
    licitaciones.filter((l) => l.rollover_pct != null).reduce((sum, l, _, arr) => {
      return sum + (l.rollover_pct ?? 0) / arr.length
    }, 0)

  return (
    <div>
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>LICITACIONES DEL TESORO NACIONAL</span>
        <span style={{ color: "#444", fontWeight: 400, fontSize: 9 }}>FUENTE: argentina.gob.ar</span>
      </div>

      {loading && (
        <div style={{ padding: 24, color: "#555", fontSize: 11, textAlign: "center" }}>
          Scrapeando licitaciones de argentina.gob.ar... (puede demorar ~5s)
        </div>
      )}

      {error && (
        <div style={{ padding: 12, color: "#FF433D", fontSize: 11 }}>
          Error al obtener licitaciones: {error}
        </div>
      )}

      {/* Última licitación — hero */}
      {ultima && !loading && (
        <div style={{ background: "#060606", border: "1px solid #1a1a1a", margin: 1, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>
              Última licitación — {ultima.fecha}
            </div>
            <a
              href={ultima.url}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 9, color: "#0068FF", textDecoration: "none" }}
            >
              Ver fuente ↗
            </a>
          </div>

          <div style={{ display: "flex", gap: 1, flexWrap: "wrap", background: "#111", padding: 1 }}>
            {[
              { label: "Vencimientos", value: fmtMonto(ultima.vencimientos_bn), unit: "$ millones" },
              { label: "Adjudicado", value: fmtMonto(ultima.adjudicado_bn), unit: "$ millones" },
            ].map((item) => (
              <div key={item.label} style={{ flex: "1 1 150px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "8px 12px" }}>
                <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700, color: "#FFA028" }}>
                  {item.value}
                </div>
                <div style={{ fontSize: 9, color: "#444" }}>{item.unit}</div>
              </div>
            ))}
            <div style={{ flex: "1 1 150px", background: "#0a0a0a", border: "1px solid #1a1a1a", padding: "8px 12px" }}>
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Rollover
              </div>
              <div style={{ fontSize: 18, fontFamily: "monospace", fontWeight: 700 }}>
                <RolloverBadge pct={ultima.rollover_pct} />
              </div>
              <div style={{ fontSize: 9, color: "#444" }}>≥100% = financiamiento neto positivo</div>
            </div>
          </div>

          {/* Instrumentos */}
          {ultima.instrumentos.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Instrumentos adjudicados
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ultima.instrumentos.map((inst, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#0d0d0d",
                      border: "1px solid #222",
                      padding: "4px 10px",
                      fontSize: 11,
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#FFA028", fontWeight: 700 }}>{inst.tipo}</span>
                    <span style={{ color: "#888" }}>{inst.tem.toFixed(2)}% TEM</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabla de historial */}
      {licitaciones.length > 0 && !loading && (
        <div style={{ marginTop: 1 }}>
          <div style={{ padding: "4px 8px", background: "#0d0d0d", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #111" }}>
            Historial de licitaciones — promedio rollover:{" "}
            <span style={{ color: rolloverPromedio >= 100 ? "#4AF6C3" : "#FF433D" }}>
              {rolloverPromedio.toFixed(1)}%
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Fecha", "Vencimientos ($M)", "Adjudicado ($M)", "Rollover", "Instrumentos", ""].map((h) => (
                  <th key={h} style={{ padding: "4px 8px", fontSize: 9, color: "#555", textAlign: h === "Fecha" ? "left" : "right", borderBottom: "1px solid #1a1a1a", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {licitaciones.map((l, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#060606" : "#080808" }}>
                  <td style={{ padding: "4px 8px", fontSize: 11, color: "#FFA028" }}>{l.fecha || "—"}</td>
                  <td style={{ padding: "4px 8px", fontSize: 11, color: "#ccc", textAlign: "right", fontFamily: "monospace" }}>
                    {fmtMonto(l.vencimientos_bn)}
                  </td>
                  <td style={{ padding: "4px 8px", fontSize: 11, color: "#ccc", textAlign: "right", fontFamily: "monospace" }}>
                    {fmtMonto(l.adjudicado_bn)}
                  </td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>
                    <RolloverBadge pct={l.rollover_pct} />
                  </td>
                  <td style={{ padding: "4px 8px", fontSize: 10, textAlign: "right", color: "#666" }}>
                    {l.instrumentos.map((inst) => inst.tipo).join(", ") || "—"}
                  </td>
                  <td style={{ padding: "4px 8px" }}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 9, color: "#0068FF", textDecoration: "none" }}
                    >
                      ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && licitaciones.length === 0 && !error && (
        <div style={{ padding: 16, color: "#555", fontSize: 11 }}>
          No se encontraron licitaciones. El scraping de argentina.gob.ar puede haber fallado o no hay resultados publicados.
        </div>
      )}
    </div>
  )
}
