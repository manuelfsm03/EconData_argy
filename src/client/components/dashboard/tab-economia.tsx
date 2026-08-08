/**
 * TabEconomia — Tipos de cambio + BCRA
 *
 * API: /api/economia?endpoint=dolar
 *      /api/economia?endpoint=bcra
 *
 * Portado de EconData_argy/js/components/sections/economia/SeccionDolar.js
 */

"use client"

import { useState, useEffect, useCallback } from "react"

// ── Types ────────────────────────────────────────────────────────────────────

interface DolarRate {
  casa: string
  nombre: string
  compra: number | null
  venta: number | null
  fechaActualizacion: string
}

interface BcraData {
  reservas: [string, number][]
  riesgo_pais: { d: string; v: number }[] | [string, number][]
  badlar: [string, number][]
}

// ── Config ───────────────────────────────────────────────────────────────────

const DOLAR_CONFIG: Record<string, { label: string; color: string }> = {
  oficial: { label: "Oficial BNA", color: "#4CAF50" },
  blue: { label: "Blue", color: "#e63946" },
  bolsa: { label: "MEP / Bolsa", color: "#2196F3" },
  contadoconliqui: { label: "CCL", color: "#9C27B0" },
  mayorista: { label: "Mayorista", color: "#FF9800" },
  cripto: { label: "Crypto (USDT)", color: "#FF6600" },
  tarjeta: { label: "Tarjeta / Solidario", color: "#607D8B" },
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function KPIBlock({
  label,
  value,
  unit,
  valueColor,
}: {
  label: string
  value: string | null
  unit: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        padding: "10px 14px",
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "var(--amber)", fontFamily: "var(--font-data)" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{unit}</div>
    </div>
  )
}

function DolarCard({ rate, oficial }: { rate: DolarRate; oficial: DolarRate | null }) {
  const cfg = DOLAR_CONFIG[rate.casa] ?? { label: rate.nombre, color: "var(--text-dim)" }
  const brecha =
    rate.casa === "blue" && oficial?.venta && rate.venta
      ? ((rate.venta / oficial.venta - 1) * 100).toFixed(1)
      : null

  return (
    <div
      style={{
        background: "var(--bg)",
        borderTop: `2px solid ${cfg.color}`,
        border: `1px solid var(--border)`,
        borderTopColor: cfg.color,
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
        {cfg.label}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)" }}>COMPRA</div>
          <div style={{ fontSize: 15, color: "#ccc", fontFamily: "var(--font-data)", fontWeight: 600 }}>
            ${rate.compra?.toFixed(2) ?? "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-dim)" }}>VENTA</div>
          <div style={{ fontSize: 15, color: "var(--text)", fontFamily: "var(--font-data)", fontWeight: 700 }}>
            ${rate.venta?.toFixed(2) ?? "—"}
          </div>
        </div>
      </div>
      {brecha !== null && (
        <div
          style={{
            fontSize: 9,
            marginTop: 4,
            color: parseFloat(brecha) > 0 ? "#e63946" : "#4CAF50",
          }}
        >
          BRECHA {parseFloat(brecha) > 0 ? "+" : ""}{brecha}%
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TabEconomia() {
  const [dolar, setDolar] = useState<DolarRate[] | null>(null)
  const [bcra, setBcra] = useState<BcraData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [dolarRes, bcraRes] = await Promise.all([
        fetch("/api/economia?endpoint=dolar"),
        fetch("/api/economia?endpoint=bcra"),
      ])
      if (dolarRes.ok) {
        const j = await dolarRes.json()
        setDolar(j.data)
        setLastUpdate(j.updated_at)
      }
      if (bcraRes.ok) {
        const j = await bcraRes.json()
        setBcra(j.data)
      }
    } catch (err) {
      console.error("[TabEconomia]", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div style={{ padding: 24, color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>
        Cargando cotizaciones...
      </div>
    )
  }

  const oficial = dolar?.find((d) => d.casa === "oficial") ?? null

  // BCRA values
  const reservas = bcra?.reservas?.[0]?.[1]
  const badlar = bcra?.badlar?.[0]?.[1]
  const riesgoPaisRaw = bcra?.riesgo_pais
  let riesgoPais: number | null = null
  if (Array.isArray(riesgoPaisRaw) && riesgoPaisRaw.length > 0) {
    const last = riesgoPaisRaw[riesgoPaisRaw.length - 1] as [string, number] | { d: string; v: number }
    riesgoPais = Array.isArray(last) ? last[1] : (last as { v: number }).v
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div className="bbg-panel-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>TIPOS DE CAMBIO — ARGENTINA</span>
        {lastUpdate && (
          <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>
            UPD {new Date(lastUpdate).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Dólar grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 1,
          background: "var(--bg-elev-2)",
          padding: 1,
        }}
      >
        {dolar?.map((rate) => (
          <DolarCard key={rate.casa} rate={rate} oficial={oficial} />
        ))}
      </div>

      {/* BCRA section */}
      <div className="bbg-panel-header" style={{ marginTop: 1 }}>INDICADORES BCRA</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 1,
          background: "var(--bg-elev-2)",
          padding: 1,
        }}
      >
        <KPIBlock
          label="Reservas Internacionales"
          value={reservas != null ? reservas.toLocaleString("es-AR") : null}
          unit="USD Millones"
          valueColor="var(--positive)"
        />
        <KPIBlock
          label="Riesgo País (EMBI)"
          value={riesgoPais != null ? riesgoPais.toLocaleString("es-AR") : null}
          unit="bps"
          valueColor={
            riesgoPais == null ? "var(--text-dim)" : riesgoPais > 1000 ? "var(--negative)" : riesgoPais > 500 ? "var(--amber)" : "var(--positive)"
          }
        />
        <KPIBlock
          label="Tasa BADLAR"
          value={badlar != null ? badlar.toFixed(2) : null}
          unit="% TNA"
          valueColor="#FFD700"
        />
      </div>

      {/* Source note */}
      <div style={{ padding: "4px 8px", fontSize: 9, color: "var(--text-mute)", borderTop: "1px solid var(--bg-elev-2)" }}>
        FUENTE: dolarapi.com · datos.gob.ar · estadisticasbcra.com (riesgo país requiere BCRA_TOKEN)
      </div>
    </div>
  )
}
