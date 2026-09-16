"use client"

/**
 * AgroPrecios — precios de la pizarra Rosario + diferencial FOB vs CBOT.
 *
 * Consume /api/agro-precios (API pública de granos.ar). Muestra los 5 granos
 * con su precio en ARS/tn y USD/tn y la variación vs la rueda anterior, más el
 * "descuento argentino": cuánto por debajo del CBOT está el FOB local.
 *
 * granos.ar pide atribución por su licencia de uso libre: se muestra en el
 * header y al pie.
 */

import { useEffect, useState } from "react"
import { SectionHeader } from "../ui/section-header"

type PrecioGrano = { grano: string; arsTn: number | null; usdTn: number | null; variacionPct: number | null }
type DiferencialGrano = { grano: string; fobUsdTn: number | null; cbotUsdTn: number | null; diferencialUsdTn: number | null }
type PreciosAgro = {
  fecha: string
  tipoCambio: number | null
  fuentePrecios: string
  precios: PrecioGrano[]
  diferenciales: DiferencialGrano[]
}
type Respuesta = { data: PreciosAgro; source: string; stale?: boolean }

const miles = (n: number | null, dec = 0) =>
  n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })

function colorVar(v: number | null) {
  if (v == null || v === 0) return "var(--text-dim)"
  return v > 0 ? "var(--positive)" : "var(--negative)"
}

export function AgroPrecios() {
  const [resp, setResp] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch("/api/agro-precios")
      .then(r => r.json())
      .then(j => {
        if (j?.error || !j?.data) { setError("Precios no disponibles"); return }
        setResp(j as Respuesta)
      })
      .catch(() => setError("No se pudo consultar los precios"))
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return <div style={{ padding: 16, fontSize: 11, color: "var(--text-dim)" }}>Cargando precios...</div>
  if (error || !resp) return <div style={{ padding: 16, fontSize: 11, color: "var(--negative)" }}>{error ?? "Sin datos"}</div>

  const { data } = resp
  const difPorGrano = new Map(data.diferenciales.map(d => [d.grano, d]))

  return (
    <div>
      <SectionHeader title="Pizarra Rosario — precios de granos" source={`granos.ar · ${data.fuentePrecios}`} />

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Grano", "ARS/tn", "USD/tn", "vs rueda ant.", "FOB vs CBOT"].map((h, i) => (
              <th key={h} style={{
                padding: "6px 10px", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase",
                letterSpacing: 1, textAlign: i === 0 ? "left" : "right", borderBottom: "1px solid var(--border)",
              }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {data.precios.map(p => {
              const dif = difPorGrano.get(p.grano)?.diferencialUsdTn ?? null
              return (
                <tr key={p.grano} style={{ borderBottom: "1px solid var(--bg-elev-2)" }}>
                  <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{p.grano}</td>
                  <td style={{ padding: "7px 10px", fontSize: 12, textAlign: "right", fontFamily: "var(--font-data)", color: "#ccc" }}>
                    ${miles(p.arsTn)}
                  </td>
                  <td style={{ padding: "7px 10px", fontSize: 12, textAlign: "right", fontFamily: "var(--font-data)", color: "var(--amber)" }}>
                    {p.usdTn == null ? "—" : `US$${miles(p.usdTn, 1)}`}
                  </td>
                  <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", fontFamily: "var(--font-data)", color: colorVar(p.variacionPct) }}>
                    {p.variacionPct == null ? "—" : `${p.variacionPct > 0 ? "+" : ""}${p.variacionPct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}
                  </td>
                  <td style={{ padding: "7px 10px", fontSize: 11, textAlign: "right", fontFamily: "var(--font-data)", color: dif == null ? "var(--text-dim)" : "var(--negative)" }}>
                    {dif == null ? "—" : `${dif > 0 ? "+" : ""}US$${miles(dif, 1)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "8px 12px", fontSize: 9, color: "var(--text-dim)", lineHeight: 1.6 }}>
        {data.tipoCambio != null && <>Tipo de cambio BNA divisas: ${miles(data.tipoCambio, 1)}. </>}
        <strong style={{ color: "var(--text-mute)" }}>FOB vs CBOT</strong> = cuánto por debajo del precio de Chicago
        cotiza el FOB argentino (el "descuento" que reflejan retenciones y logística).
        {resp.stale && <span style={{ color: "var(--negative)" }}> · dato de la última lectura buena (fuente caída).</span>}
        <div style={{ marginTop: 3, color: "var(--text-mute)" }}>
          Fuente: {resp.source} · datos {data.fecha}
        </div>
      </div>
    </div>
  )
}
