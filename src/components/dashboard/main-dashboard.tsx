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

// ── Welcome Modal ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "⇄", label: "Tipos de cambio",   desc: "Blue · CCL · MEP · Oficial · Brecha cambiaria en tiempo real" },
  { icon: "↑",  label: "Inflación IPC",     desc: "Variación mensual e interanual · Núcleo · REM expectativas" },
  { icon: "⚡", label: "Riesgo País",        desc: "EMBI+ Argentina · Variación semanal y mensual" },
  { icon: "🏦", label: "BCRA",              desc: "Reservas · Base monetaria · Tasas · Depósitos · CER · UVA" },
  { icon: "📊", label: "Breakeven",         desc: "Tasa real implícita · LECAP vs REM · Inflación vs CER" },
  { icon: "📰", label: "Noticias",          desc: "Feed en vivo · Economía · Finanzas · Política · Commodities" },
]

function WelcomeModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#080808",
          border: "1px solid #222",
          maxWidth: 680, width: "calc(100% - 32px)",
          padding: "40px 40px 32px",
          position: "relative",
        }}
      >
        {/* Línea naranja superior */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #FFA028, #FF433D44)" }} />

        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", letterSpacing: 4, color: "#FFA028" }}>
            LA PIZARRA
            <span style={{ fontSize: 12, color: "#FFA02866", marginLeft: 6 }}>.ar</span>
          </div>
          <div style={{ fontSize: 10, color: "#333", fontFamily: "monospace", letterSpacing: 2, marginTop: 4 }}>
            PANEL DE CONTROL MACROECONÓMICO · ARGENTINA
          </div>
        </div>

        {/* Descripción */}
        <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.8, marginBottom: 10, fontFamily: "monospace" }}>
          Argentina es una de las economías más complejas y volátiles del mundo.
          Leerla bien —{" "}
          <span style={{ color: "#FFA028" }}>a tiempo y con los datos correctos</span>
          {" "}— marca la diferencia entre anticipar un movimiento y reaccionar tarde.
        </p>
        <p style={{ fontSize: 12, color: "#666", lineHeight: 1.8, marginBottom: 6, fontFamily: "monospace" }}>
          La Pizarra reúne en un solo lugar las variables que realmente importan:
          la brecha cambiaria, las expectativas de inflación del mercado, el nivel de
          reservas, la tasa real implícita en los instrumentos de deuda y el humor
          del riesgo soberano. Todo actualizado, todo sin intermediarios.
        </p>
        <p style={{ fontSize: 12, color: "#444", lineHeight: 1.8, marginBottom: 28, fontFamily: "monospace" }}>
          Pensado para el investigador que necesita contexto rápido, el analista que
          monitorea posiciones y el estudiante que quiere entender cómo se mueve
          realmente una economía de frontera.
        </p>

        {/* Features grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 32 }}>
          {FEATURES.map((f) => (
            <div key={f.label} style={{
              background: "#0d0d0d", border: "1px solid #1a1a1a",
              padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: "#FFA028", letterSpacing: 0.5, marginBottom: 2 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fuentes */}
        <div style={{ fontSize: 8, color: "#2a2a2a", fontFamily: "monospace", marginBottom: 24, letterSpacing: 0.5 }}>
          FUENTES · datos.gob.ar · BCRA · INDEC · ArgentinaDatos · Secretaría de Finanzas
        </div>

        {/* Botón */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: "#222", fontFamily: "monospace" }}>ESC para cerrar</span>
          <button
            onClick={onClose}
            style={{
              background: "#FFA028", border: "none", color: "#000",
              fontSize: 12, fontWeight: 800, fontFamily: "monospace",
              letterSpacing: 1.5, padding: "10px 28px",
              cursor: "pointer", textTransform: "uppercase",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FFB84D")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFA028")}
          >
            Ingresar al panel →
          </button>
        </div>
      </div>
    </div>
  )
}

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

function TabBCRALazy({ initialSubtab }: { initialSubtab?: string | null }) {
  const [Component, setComponent] = useState<React.ComponentType<{ initialSubtab?: string | null }> | null>(null)

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
  return <Component initialSubtab={initialSubtab} />
}

// ── Tab Noticias ─────────────────────────────────────────────────────────────

function TabNoticias() {
  return <NewsFeed />
}

// ── Dashboard principal ───────────────────────────────────────────────────────

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("resumen")
  const [macroSubtab, setMacroSubtab] = useState<string | null>(null)
  const [bcraSubtab, setBcraSubtab]   = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const macroRef = useRef<{ setSubtab?: (s: string) => void }>({})

  useEffect(() => {
    const seen = localStorage.getItem("lapizarra_welcomed")
    if (!seen) setShowWelcome(true)
  }, [])

  const handleCloseWelcome = useCallback(() => {
    localStorage.setItem("lapizarra_welcomed", "1")
    setShowWelcome(false)
  }, [])

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
    <div style={{ background: "#000", minHeight: "100vh", overflowX: "hidden" }}>

      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}

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
