"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { TabMacro } from "./tab-macro"
import { TabGeopolitica } from "./tab-geopolitica"
import { NewsFeed } from "./news-feed"
import { TickerTape } from "./ticker-tape"
import { CommandPalette } from "./command-palette"
import { LiveSection } from "./live-section"

// ── Tipos ────────────────────────────────────────────────────────────────────

interface NavTab {
  key: string
  label: string
}

const MAIN_TABS: NavTab[] = [
  { key: "resumen",   label: "Resumen"  },
  { key: "finanzas",  label: "Finanzas" },
  { key: "macro",     label: "Macro"    },
  { key: "bcra",      label: "BCRA"     },
  { key: "noticias",  label: "Noticias" },
]

// ── Placeholders ──────────────────────────────────────────────────────────────

function ResumenPlaceholder() {
  return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: "monospace" }}>
      <div style={{ fontSize: 9, color: "#333", letterSpacing: 3, textTransform: "uppercase" }}>
        RESUMEN — PRÓXIMAMENTE
      </div>
      <div style={{ fontSize: 8, color: "#222", marginTop: 12 }}>
        Aquí se mostrarán los KPIs más importantes de todas las secciones en una sola vista.
      </div>
    </div>
  )
}

function FinanzasPlaceholder() {
  return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: "monospace" }}>
      <div style={{ fontSize: 9, color: "#CE93D8", letterSpacing: 3, textTransform: "uppercase" }}>
        FINANZAS — RAMA PISTA
      </div>
      <div style={{ fontSize: 8, color: "#333", marginTop: 12 }}>
        Tipo de Cambio · ROFEX · Renta Fija · Renta Variable
      </div>
      <div style={{ fontSize: 8, color: "#222", marginTop: 8 }}>
        En desarrollo por Luca Pistarelli (branch: Pista)
      </div>
    </div>
  )
}

// ── Tab BCRA — lazy import para no aumentar el bundle inicial ─────────────────

function TabBCRALazy() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    import("./tab-bcra")
      .then((m) => setComponent(() => m.TabBCRA))
      .catch(() => setComponent(() => () => (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "monospace", color: "#333", fontSize: 9 }}>
          BCRA — CARGANDO...
        </div>
      )))
  }, [])

  if (!Component) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "monospace", color: "#333", fontSize: 9 }}>
      BCRA — CARGANDO...
    </div>
  )
  return <Component />
}

// ── Tab Noticias (combina NewsFeed + Geopolítica + EN VIVO) ─────────────────

function TabNoticias() {
  const [vista, setVista] = useState<"locales" | "internacional" | "vivo">("locales")

  const btnStyle = (active: boolean) => ({
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid #FFA028" : "2px solid transparent",
    cursor: "pointer",
    padding: "6px 14px",
    fontSize: 10,
    fontFamily: "monospace",
    color: active ? "#FFA028" : "#555",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  })

  return (
    <div>
      {/* Sub-nav noticias */}
      <div style={{ background: "#060606", borderBottom: "1px solid #111", display: "flex", paddingLeft: 8 }}>
        <button style={btnStyle(vista === "locales")}       onClick={() => setVista("locales")}>       Argentina      </button>
        <button style={btnStyle(vista === "internacional")} onClick={() => setVista("internacional")}> Internacional  </button>
        <button style={btnStyle(vista === "vivo")}          onClick={() => setVista("vivo")}>          EN VIVO        </button>
      </div>

      {vista === "locales"       && <NewsFeed />}
      {vista === "internacional" && <TabGeopolitica />}
      {vista === "vivo"          && <LiveSection />}
    </div>
  )
}

// ── Dashboard principal ───────────────────────────────────────────────────────

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("macro")
  const [macroSubtab, setMacroSubtab] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const macroRef = useRef<{ setSubtab?: (s: string) => void }>({})

  // Atajo "/" para abrir la búsqueda
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const handleNavigate = useCallback((tab: string, subtab: string | null) => {
    setActiveTab(tab)
    setMacroSubtab(subtab)
  }, [])

  const now = new Date()
  const dateStr = now
    .toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()

  return (
    <div style={{ background: "#000", minHeight: "100vh", overflowX: "hidden" }}>
      {/* ── FILA 1: Logo + Tabs principales + Lupa ─────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "#0a0a0a",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px", borderRight: "1px solid #1a1a1a", gap: 10 }}>
          <span style={{ color: "#FFA028", fontWeight: 700, fontSize: 11, letterSpacing: 2, fontFamily: "monospace", whiteSpace: "nowrap" }}>
            ECONDATA AR
          </span>
          <span style={{ fontSize: 8, color: "#333", fontFamily: "monospace", whiteSpace: "nowrap" }}>
            {dateStr}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "10px 18px",
                fontSize: 11,
                fontFamily: "monospace",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: activeTab === tab.key ? "#FFA028" : "#555",
                borderBottom: activeTab === tab.key ? "2px solid #FFA028" : "2px solid transparent",
                whiteSpace: "nowrap",
                transition: "color 0.1s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lupa */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px", borderLeft: "1px solid #1a1a1a" }}>
          <button
            onClick={() => setSearchOpen(true)}
            title="Buscar (tecla /)"
            style={{
              background: "none",
              border: "1px solid #1a1a1a",
              cursor: "pointer",
              color: "#444",
              padding: "5px 10px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "monospace",
            }}
          >
            🔍
            <span style={{ fontSize: 8, color: "#333", letterSpacing: 1 }}>/</span>
          </button>
        </div>
      </div>

      {/* ── FILA 2: Ticker de noticias scrolling ───────────────────────────── */}
      <TickerTape />

      {/* ── CONTENIDO ───────────────────────────────────────────────────────── */}
      <div>
        {activeTab === "resumen"   && <ResumenPlaceholder />}
        {activeTab === "finanzas"  && <FinanzasPlaceholder />}
        {activeTab === "macro"     && <TabMacro initialSubtab={macroSubtab} />}
        {activeTab === "bcra"      && <TabBCRALazy />}
        {activeTab === "noticias"  && <TabNoticias />}
      </div>

      {/* ── Command Palette ─────────────────────────────────────────────────── */}
      <CommandPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
