"use client"

import { useEffect, useState, type ReactNode } from "react"
import { BBGAreaChart } from "../charts/bbg-area-chart"

interface DlRow {
  ticker: string
  vencimiento: string | null
  precio: number | null
  change1D: number | null
  volumen: number | null
  asOf: string | null
}
interface VolPoint { date: string; volume: number; instruments: number }

function fmt(v: number | null, d = 2): string {
  return v == null ? "—" : v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })
}

/**
 * Familia dollar-linked: tabla de instrumentos + volumen diario agregado (T+1).
 * Si la API no devuelve instrumentos se muestra `sinDatos` (el mensaje honesto de
 * siempre); jamás ceros inventados.
 */
export function DollarLinkedPanel({ sinDatos }: { sinDatos: ReactNode }) {
  const [rows, setRows] = useState<DlRow[] | null>(null)
  const [vol, setVol] = useState<VolPoint[]>([])
  const [unidad, setUnidad] = useState("")

  useEffect(() => {
    fetch("/api/bonos?familia=dollarlinked")
      .then(r => r.json())
      .then(j => {
        setRows(Array.isArray(j.data) ? j.data : [])
        setVol(Array.isArray(j.volumen_agregado) ? j.volumen_agregado : [])
        setUnidad(typeof j.volumen_unidad === "string" ? j.volumen_unidad : "")
      })
      .catch(() => setRows([]))
  }, [])

  if (rows == null) {
    return <div style={{ padding: 32, fontSize: 10, color: "var(--text-mute)", textAlign: "center" }}>Cargando dollar-linked…</div>
  }
  if (rows.length === 0) return <>{sinDatos}</>

  return (
    <div style={{ background: "var(--bg)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "var(--font-data)" }}>
        <thead>
          <tr style={{ color: "var(--text-mute)", textAlign: "right" }}>
            <th style={{ padding: "4px 8px", textAlign: "left" }}>Ticker</th>
            <th style={{ padding: "4px 8px" }}>Vencimiento</th>
            <th style={{ padding: "4px 8px" }}>Precio</th>
            <th style={{ padding: "4px 8px" }}>Var. diaria</th>
            <th style={{ padding: "4px 8px" }}>Volumen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.ticker} style={{ textAlign: "right", color: "var(--text-dim)" }}>
              <td style={{ padding: "3px 8px", textAlign: "left" }}>{r.ticker}</td>
              <td style={{ padding: "3px 8px" }}>{r.vencimiento ?? "—"}</td>
              <td style={{ padding: "3px 8px" }}>{fmt(r.precio)}</td>
              <td style={{ padding: "3px 8px" }}>{r.change1D == null ? "—" : `${fmt(r.change1D)}%`}</td>
              <td style={{ padding: "3px 8px" }}>{fmt(r.volumen, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {vol.length > 0 && (
        <BBGAreaChart
          title="VOLUMEN DOLLAR-LINKED OPERADO EN BYMA (T+1)"
          data={vol.map(p => ({ date: p.date, volumen: p.volume }))}
          areas={[{ key: "volumen", name: "Volumen", color: "var(--amber)" }]}
          height={240}
          formatValue={v => fmt(v, 0)}
          defaultRange="all"
        />
      )}

      <div style={{ padding: "8px 14px", fontSize: 8, color: "var(--text-mute)", lineHeight: 1.7 }}>
        Fuente: BYMA Data abierto (demorado 20 min). Volumen: {unidad || "suma del campo v de BYMA por rueda"}.
        La unidad y el universo de instrumentos no están verificados contra el prospecto.
      </div>
    </div>
  )
}
