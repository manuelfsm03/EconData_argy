"use client"

import { useState, useEffect, useRef } from "react"

export interface SearchItem {
  label: string
  tab: string
  subtab: string | null
  description?: string
}

const SEARCH_INDEX: SearchItem[] = [
  // Macro
  { label: "EMAE — Actividad Económica",       tab: "macro",    subtab: "emae",        description: "Estimador Mensual de Actividad Económica" },
  { label: "IPC — Inflación",                  tab: "macro",    subtab: "ipc",         description: "Índice de Precios al Consumidor" },
  { label: "Balanza Comercial",                tab: "macro",    subtab: "balanza",     description: "Exportaciones, importaciones y saldo" },
  { label: "Resultado Fiscal",                 tab: "macro",    subtab: "fiscal",      description: "Superávit/déficit primario y financiero" },
  { label: "Desigualdad — Gini / PBI",         tab: "macro",    subtab: "desigualdad", description: "Coeficiente Gini y distribución del ingreso" },
  { label: "Pirámides Poblacionales",          tab: "macro",    subtab: "piramides",   description: "Pirámide poblacional Argentina + proyecciones" },
  { label: "Tipo de Cambio Real (ITCRM)",      tab: "macro",    subtab: "tcr",         description: "Índice de Tipo de Cambio Real Multilateral" },
  { label: "Big Mac Index",                    tab: "macro",    subtab: "bigmac",      description: "Paridad del poder adquisitivo via hamburguesas" },
  { label: "Riesgo País (EMBI+)",              tab: "macro",    subtab: "riesgo",      description: "Spread soberano Argentina vs Treasury" },
  { label: "Deuda Pública",                    tab: "macro",    subtab: "deuda",       description: "Stock, composición y perfil de vencimientos" },
  // BCRA
  { label: "Plazo Fijo — Tasas",               tab: "bcra",     subtab: "plazofijo",   description: "BADLAR, TM20, Tasa PM, plazo fijo UVA" },
  { label: "Agregados Monetarios",             tab: "bcra",     subtab: "agregados",   description: "Base monetaria, M1, M2, depósitos" },
  { label: "Reservas Internacionales",         tab: "bcra",     subtab: "reservas",    description: "Reservas brutas y netas (metodología F. Machado)" },
  { label: "Reservas Netas (Fede Machado)",    tab: "bcra",     subtab: "reservas",    description: "Cálculo de reservas netas descontando pasivos" },
  { label: "Compras y Ventas BCRA",            tab: "bcra",     subtab: "compras",     description: "Posición compradora/vendedora en el MULC" },
  // Noticias
  { label: "Noticias Locales",                 tab: "noticias", subtab: null,          description: "RSS: Ámbito, Infobae, Cronista, La Nación" },
  { label: "Noticias Internacionales",         tab: "noticias", subtab: null,          description: "RSS: WSJ, FT, BBC, Guardian, DW, Al Jazeera" },
  { label: "EN VIVO — Canales",                tab: "noticias", subtab: null,          description: "C5N, DW News, BBC News, Euronews" },
]

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (tab: string, subtab: string | null) => void
}

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? SEARCH_INDEX.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.description ?? "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : SEARCH_INDEX.slice(0, 8)

  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      if (e.key === "Enter" && filtered[selected]) {
        onNavigate(filtered[selected].tab, filtered[selected].subtab)
        onClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, filtered, selected, onNavigate, onClose])

  if (!isOpen) return null

  const highlight = (text: string) => {
    if (!query.trim()) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ color: "var(--amber)", fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    )
  }

  const TAB_COLORS: Record<string, string> = {
    macro: "var(--amber)",
    bcra: "var(--positive)",
    noticias: "var(--sky)",
    finanzas: "#CE93D8",
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          zIndex: 999, backdropFilter: "blur(2px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
          width: "min(540px, 90vw)", zIndex: 1000,
          background: "var(--bg-elev)", border: "1px solid var(--border)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "10px 14px", gap: 10 }}>
          <span style={{ color: "var(--text-dim)", fontSize: 14 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar indicador, sección..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text)", fontSize: 13, fontFamily: "var(--font-data)",
            }}
          />
          <span style={{ fontSize: 9, color: "var(--text-mute)", border: "1px solid var(--border-hi)", padding: "2px 5px", fontFamily: "var(--font-data)" }}>ESC</span>
        </div>

        {/* Results */}
        <div>
          {filtered.length === 0 && (
            <div style={{ padding: "16px 14px", fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-data)", textAlign: "center" }}>
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          )}
          {filtered.map((item, i) => (
            <div
              key={`${item.tab}-${item.label}`}
              onClick={() => { onNavigate(item.tab, item.subtab); onClose() }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 14px", cursor: "pointer",
                background: i === selected ? "var(--bg-elev-2)" : "transparent",
                borderBottom: "1px solid var(--bg-elev-2)",
              }}
              onMouseEnter={() => setSelected(i)}
            >
              <div>
                <div style={{ fontSize: 11, color: "#ccc", fontFamily: "var(--font-data)" }}>
                  {highlight(item.label)}
                </div>
                {item.description && (
                  <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2, fontFamily: "var(--font-data)" }}>
                    {item.description}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 8, fontFamily: "var(--font-data)", letterSpacing: 1, textTransform: "uppercase",
                  color: TAB_COLORS[item.tab] ?? "var(--text-mute)",
                  border: `1px solid ${TAB_COLORS[item.tab] ?? "var(--border-hi)"}33`,
                  padding: "2px 5px",
                }}
              >
                {item.tab}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "6px 14px", borderTop: "1px solid var(--bg-elev-2)", display: "flex", gap: 12 }}>
          {[["↑↓", "navegar"], ["↵", "ir"], ["ESC", "cerrar"]].map(([key, label]) => (
            <span key={key} style={{ fontSize: 8, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
              <span style={{ color: "var(--text-dim)" }}>{key}</span> {label}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
