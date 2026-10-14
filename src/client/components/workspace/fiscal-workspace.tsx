"use client"

/**
 * FiscalWorkspace — Hub de herramientas fiscales de La Pizarra.
 *
 * Incluye:
 *   · Calculadora de retenciones agropecuarias
 *   · Estimador simplificado de Impuesto a las Ganancias
 *
 * Sigue el mismo patrón de sección que AgroWorkspace / BondsWorkspace.
 * Todas las calculadoras muestran disclaimer "Estimación orientativa".
 */

import { useState } from "react"
import { Calculator, Wheat } from "lucide-react"
import { RetencionesCalc } from "@/client/components/fiscal/retenciones-calc"
import { GananciasCalc } from "@/client/components/fiscal/ganancias-calc"

type FiscalTab = "retenciones" | "ganancias"

interface FiscalToolDef {
  id: FiscalTab
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  descripcion: string
}

const FISCAL_TOOLS: FiscalToolDef[] = [
  {
    id: "retenciones",
    label: "Retenciones Agro",
    Icon: Wheat,
    descripcion: "Calculá cuánto resignás en derechos de exportación según cultivo, toneladas y precio",
  },
  {
    id: "ganancias",
    label: "Ganancias (4ta)",
    Icon: Calculator,
    descripcion: "Estimá tu Impuesto a las Ganancias mensual en relación de dependencia",
  },
]

export function FiscalWorkspace() {
  const [activeTab, setActiveTab] = useState<FiscalTab>("retenciones")

  const active = FISCAL_TOOLS.find(t => t.id === activeTab)!

  return (
    <div style={{ padding: "16px 18px 32px" }}>
      {/* Header */}
      <header style={{ marginBottom: 16, maxWidth: 820 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
          Herramientas Fiscales
        </h1>
        <p style={{ fontSize: 11, color: "var(--text-mute)", margin: 0, lineHeight: 1.6 }}>
          Calculadoras orientativas para estimaciones fiscales rápidas. Los valores son
          aproximados — verificar siempre con ARCA y organismos oficiales antes de tomar decisiones.
        </p>
      </header>

      {/* Selector de herramienta */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {FISCAL_TOOLS.map(({ id, label, Icon, descripcion }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
                padding: "12px 16px", borderRadius: 6, cursor: "pointer",
                border: "1px solid",
                borderColor: isActive ? "var(--amber)" : "var(--border)",
                background: isActive ? "var(--amber-soft)" : "var(--bg-elev)",
                minWidth: 200, maxWidth: 280,
                transition: "border-color 0.1s, background 0.1s",
              }}
            >
              <Icon
                size={16}
                strokeWidth={isActive ? 2.2 : 1.7}
              />
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: isActive ? "var(--amber)" : "var(--text)",
                  fontFamily: "var(--font-ui)", marginBottom: 3,
                }}>
                  {label}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-ui)", lineHeight: 1.5 }}>
                  {descripcion}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Panel de la herramienta activa */}
      <div style={{
        border: "1px solid var(--border)",
        background: "var(--bg-elev)",
        borderRadius: 6,
      }}>
        {/* Subheader */}
        <div style={{
          padding: "11px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <active.Icon size={14} strokeWidth={2} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-ui)" }}>
            {active.label}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
            — estimación orientativa
          </span>
        </div>

        {/* Contenido */}
        {activeTab === "retenciones" && <RetencionesCalc />}
        {activeTab === "ganancias" && <GananciasCalc />}
      </div>
    </div>
  )
}
