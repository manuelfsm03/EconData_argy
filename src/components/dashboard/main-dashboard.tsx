"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { TabMacro } from "./tab-macro"
import { TabResumen } from "./tab-resumen"
import { TabFinanzas } from "./tab-finanzas"
import { NewsFeed } from "./news-feed"
import { TickerTape } from "./ticker-tape"
import { CommandPalette } from "./command-palette"
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


function FinanzasPlaceholder() {
  return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: "monospace" }}>
      <div style={{ fontSize: 9, color: "#CE93D8", letterSpacing: 3, textTransform: "uppercase" }}>
        FINANZAS — RAMA PISTA
      </div>
      <div style={{ fontSize: 8, color: "#777", marginTop: 12 }}>
        Tipo de Cambio · ROFEX · Renta Fija · Renta Variable
      </div>
      <div style={{ fontSize: 8, color: "#888", marginTop: 8 }}>
        En desarrollo por Luca Pistarelli (branch: Pista)
      </div>
    </div>
  )
}

// ── Tab BCRA — lazy import ─────────────────────────────────────────────────

function TabBCRALazy({ initialSubtab }: { initialSubtab?: string | null }) {
  const [Component, setComponent] = useState<React.ComponentType<{ initialSubtab?: string | null }> | null>(null)

  useEffect(() => {
    import("./tab-bcra")
      .then((m) => setComponent(() => m.TabBCRA))
      .catch(() => setComponent(() => () => (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "monospace", color: "#777", fontSize: 9 }}>
          BCRA — ERROR AL CARGAR
        </div>
      )))
  }, [])

  if (!Component) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "monospace", color: "#777", fontSize: 9 }}>
      BCRA — CARGANDO...
    </div>
  )
  return <Component initialSubtab={initialSubtab} />
}

// ── Tab Noticias ─────────────────────────────────────────────────────────────

function TabNoticias() {
  return <NewsFeed />
}

// ── Dashboard principal ───────────────────────────────────────────────────────

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("macro")
  const [macroSubtab, setMacroSubtab] = useState<string | null>(null)
  const [bcraSubtab, setBcraSubtab]   = useState<string | null>(null)
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

  const handleNavigate = useCallback((tab: string, subtab?: string | null, bcra?: string | null) => {
    setActiveTab(tab)
    setMacroSubtab(subtab ?? null)
    if (bcra !== undefined) setBcraSubtab(bcra)
  }, [])

  const now = new Date()
  const dateStr = now
    .toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()

  return (
    <div style={{ background: "#121214", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── FILA 1: TickerTape ───────────────────────────────────────────────── */}
      <TickerTape />

      {/* ── FILA 2: TopBar horizontal — Logo + Tabs + Search + Fecha ─────────── */}
      <div style={{
        background: "#121214",
        borderBottom: "1px solid #2A2A2F",
        height: 56,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 24,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "#FFA028",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#121214", fontFamily: "var(--font-ui)", lineHeight: 1 }}>L</span>
          </div>
          <span style={{
            fontSize: 15, fontWeight: 600, color: "#F5F3EE",
            letterSpacing: -0.2, fontFamily: "var(--font-ui)",
          }}>
            La Pizarra
          </span>
        </div>

        {/* Separador */}
        <div style={{ width: 1, height: 20, background: "#2A2A2F", flexShrink: 0 }} />

        {/* Tabs — underline style */}
        <div style={{ display: "flex", alignItems: "stretch", height: "100%", gap: 2 }}>
          {MAIN_TABS.map(({ key, label, Icon }) => {
            const active = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "0 14px",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? "#F5F3EE" : "#A8A49D",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid #FFA028" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.15s, border-color 0.15s",
                  fontFamily: "var(--font-ui)",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#F5F3EE" }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#A8A49D" }}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.6} />
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Buscador */}
        <button
          onClick={() => setSearchOpen(true)}
          title="Buscar indicador (tecla /)"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: 260, height: 34,
            background: "#1A1A1D", border: "1px solid #2A2A2F",
            borderRadius: 8, cursor: "text",
            padding: "0 12px", textAlign: "left",
            flexShrink: 0,
          }}
        >
          <Search size={13} strokeWidth={1.8} style={{ color: "#5F5C56", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#5F5C56", fontFamily: "var(--font-ui)", flex: 1 }}>
            Buscar indicador…
          </span>
          <span style={{
            fontSize: 10, color: "#5F5C56", fontFamily: "var(--font-data)",
            background: "#222226", padding: "1px 5px", borderRadius: 4,
            border: "1px solid #2A2A2F",
          }}>/</span>
        </button>

        {/* Fecha */}
        <span style={{ fontSize: 11, color: "#5F5C56", fontFamily: "var(--font-data)", flexShrink: 0 }}>
          {dateStr}
        </span>
      </div>

      {/* ── CONTENIDO ───────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 8px" }}>
        {activeTab === "resumen"   && <TabResumen onNavigate={handleNavigate} />}
        {activeTab === "finanzas"  && <TabFinanzas />}
        {activeTab === "macro"     && <TabMacro initialSubtab={macroSubtab} />}
        {activeTab === "bcra"      && <TabBCRALazy initialSubtab={bcraSubtab} />}
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
