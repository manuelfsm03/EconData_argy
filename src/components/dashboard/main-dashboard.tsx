"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { TabMacro } from "./tab-macro"
import { TabGeopolitica } from "./tab-geopolitica"
import { NewsFeed } from "./news-feed"
import { TickerTape } from "./ticker-tape"
import { CommandPalette } from "./command-palette"
import { LiveSection } from "./live-section"
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Landmark,
  Newspaper,
  Search,
} from "lucide-react"

// ── Tipos ────────────────────────────────────────────────────────────────────

interface NavTab {
  key: string
  label: string
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>
}

const MAIN_TABS: NavTab[] = [
  { key: "resumen",  label: "Resumen",  Icon: LayoutDashboard },
  { key: "finanzas", label: "Finanzas", Icon: TrendingUp       },
  { key: "macro",    label: "Macro",    Icon: BarChart2        },
  { key: "bcra",     label: "BCRA",     Icon: Landmark         },
  { key: "noticias", label: "Noticias", Icon: Newspaper        },
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

// ── Tab BCRA — lazy import ─────────────────────────────────────────────────

function TabBCRALazy() {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    import("./tab-bcra")
      .then((m) => setComponent(() => m.TabBCRA))
      .catch(() => setComponent(() => () => (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "monospace", color: "#333", fontSize: 9 }}>
          BCRA — ERROR AL CARGAR
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

// ── Tab Noticias ─────────────────────────────────────────────────────────────

function TabNoticias() {
  const [vista, setVista] = useState<"locales" | "internacional" | "vivo">("locales")

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid #FFA028" : "2px solid transparent",
    cursor: "pointer",
    padding: "6px 14px",
    fontSize: 10,
    fontFamily: "monospace",
    color: active ? "#FFA028" : "#555",
    letterSpacing: 1,
    textTransform: "uppercase",
  })

  return (
    <div>
      <div style={{ background: "#060606", borderBottom: "1px solid #111", display: "flex", paddingLeft: 8 }}>
        <button style={btnStyle(vista === "locales")}       onClick={() => setVista("locales")}>Argentina</button>
        <button style={btnStyle(vista === "internacional")} onClick={() => setVista("internacional")}>Internacional</button>
        <button style={btnStyle(vista === "vivo")}          onClick={() => setVista("vivo")}>EN VIVO</button>
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

      {/* ── FILA 1: Barra superior — solo Logo + Fecha ────────────────────────── */}
      <div style={{
        background: "#080808",
        borderBottom: "1px solid #161616",
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            color: "#FFA028", fontWeight: 800, fontSize: 13,
            letterSpacing: 2.5, fontFamily: "monospace",
          }}>
            LA PIZARRA
          </span>
          <span style={{
            fontSize: 9, color: "#FFA02860", fontFamily: "monospace",
            borderLeft: "1px solid #222", paddingLeft: 8,
          }}>
            .ar
          </span>
        </div>
        {/* Fecha */}
        <span style={{ fontSize: 8, color: "#2a2a2a", fontFamily: "monospace" }}>
          {dateStr}
        </span>
      </div>

      {/* ── FILA 2: TickerTape full-width ────────────────────────────────────── */}
      <TickerTape />

      {/* ── FILA 3: Área centrada — Buscador + Tabs ──────────────────────────── */}
      <div style={{
        background: "#050505",
        borderBottom: "1px solid #111",
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
        {/* Buscador */}
        <button
          onClick={() => setSearchOpen(true)}
          title="Buscar indicador (tecla /)"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", maxWidth: 440,
            background: "#0a0a0a", border: "1px solid #1e1e1e",
            borderRadius: 6, cursor: "text",
            padding: "7px 12px", textAlign: "left",
            marginBottom: 10,
          }}
        >
          <Search size={13} strokeWidth={1.8} style={{ color: "#444", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace", flex: 1 }}>
            Buscar indicador, sección...
          </span>
          <span style={{
            fontSize: 9, color: "#222", fontFamily: "monospace",
            background: "#111", padding: "1px 5px", borderRadius: 3,
          }}>/</span>
        </button>

        {/* Tabs centrados — pill style */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 10 }}>
          {MAIN_TABS.map(({ key, label, Icon }) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#FFA028" : "#888",
                  background: active ? "rgba(255,160,40,0.08)" : "transparent",
                  border: active ? "1px solid rgba(255,160,40,0.4)" : "1px solid #2a2a2a",
                  borderRadius: 20,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                  fontFamily: "monospace",
                }}
              >
                <Icon
                  size={13}
                  strokeWidth={active ? 2.2 : 1.6}
                  style={{ color: active ? "#FFA028" : "#555" }}
                />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── CONTENIDO ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
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
