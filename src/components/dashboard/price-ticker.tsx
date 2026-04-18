"use client"

import { useState, useEffect } from "react"

interface Rate {
  venta: number | null
  variacion: number | null
}

interface PriceData {
  oficial: Rate
  ccl: Rate
  mep: Rate
  blue: Rate
  riesgoPais: number | null
}

function varColor(v: number | null): string {
  if (v == null) return "#555"
  return v >= 0 ? "#4AF6C3" : "#FF433D"
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PriceTicker() {
  const [data, setData] = useState<PriceData | null>(null)

  const fetchPrices = async () => {
    try {
      const [dolarRes, rpRes] = await Promise.allSettled([
        fetch("/api/dolares"),
        fetch("/api/riesgo-pais"),
      ])

      const newData: PriceData = {
        oficial: { venta: null, variacion: null },
        ccl: { venta: null, variacion: null },
        mep: { venta: null, variacion: null },
        blue: { venta: null, variacion: null },
        riesgoPais: null,
      }

      if (dolarRes.status === "fulfilled" && dolarRes.value.ok) {
        const json = await dolarRes.value.json()
        const r = json.data
        if (r) {
          newData.oficial = { venta: r.oficial?.venta ?? null, variacion: r.oficial?.variacion ?? null }
          newData.ccl    = { venta: r.contadoconliqui?.venta ?? null, variacion: r.contadoconliqui?.variacion ?? null }
          newData.mep    = { venta: r.bolsa?.venta ?? null, variacion: r.bolsa?.variacion ?? null }
          newData.blue   = { venta: r.blue?.venta ?? null, variacion: r.blue?.variacion ?? null }
        }
      }

      if (rpRes.status === "fulfilled" && rpRes.value.ok) {
        const json = await rpRes.value.json()
        newData.riesgoPais = json.data?.actual?.riesgoPaisBps ?? null
      }

      setData(newData)
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 60_000)
    return () => clearInterval(interval)
  }, [])

  const items: { label: string; value: string; variacion?: number | null }[] = data
    ? [
        { label: "DÓLAR OFICIAL", value: data.oficial.venta ? `$${fmtPrice(data.oficial.venta)}` : "—", variacion: data.oficial.variacion },
        { label: "CCL",           value: data.ccl.venta    ? `$${fmtPrice(data.ccl.venta)}`    : "—", variacion: data.ccl.variacion    },
        { label: "DÓLAR MEP",     value: data.mep.venta    ? `$${fmtPrice(data.mep.venta)}`    : "—", variacion: data.mep.variacion    },
        { label: "BLUE",          value: data.blue.venta   ? `$${fmtPrice(data.blue.venta)}`   : "—", variacion: data.blue.variacion   },
        { label: "RIESGO PAÍS",   value: data.riesgoPais != null ? String(Math.round(data.riesgoPais)) : "—" },
      ]
    : []

  if (!data) return (
    <div style={{ background: "#060606", borderBottom: "1px solid #111", padding: "4px 16px", height: 28 }} />
  )

  return (
    <div
      style={{
        background: "#060606",
        borderBottom: "1px solid #111",
        padding: "4px 16px",
        display: "flex",
        alignItems: "center",
        gap: 0,
        overflowX: "auto",
        scrollbarWidth: "none",
        flexWrap: "nowrap",
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingRight: 20,
            borderRight: i < items.length - 1 ? "1px solid #1a1a1a" : "none",
            marginRight: i < items.length - 1 ? 20 : 0,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: 9, color: "#888", letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>
            {item.label}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>
            {item.value}
          </span>
          {item.variacion != null && (
            <span style={{ fontSize: 9, color: varColor(item.variacion), fontFamily: "monospace" }}>
              {item.variacion >= 0 ? "+" : ""}{item.variacion.toFixed(2)}%
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
