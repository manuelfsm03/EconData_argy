"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { TabMacro } from "./tab-macro"
import { TabResumen } from "./tab-resumen"
import { TabFinanzas } from "./tab-finanzas"
import { NewsFeed } from "./news-feed"
import { TickerTape } from "./ticker-tape"
import { CommandPalette } from "./command-palette"
import { ThemeToggle } from "@/client/components/ui/theme-toggle"
import {
  LayoutDashboard, TrendingUp, BarChart2, Landmark, Newspaper, Search,
} from "lucide-react"

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

function BCRAError() {
  return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-data)", color: "var(--text-mute)", fontSize: 11 }}>
      BCRA — ERROR AL CARGAR
    </div>
  )
}

function TabBCRALazy({ initialSubtab }: { initialSubtab?: string | null }) {
  const [Component, setComponent] = useState<React.ComponentType<{ initialSubtab?: string | null }> | null>(null)

  useEffect(() => {
    import("./tab-bcra")
      .then((m) => setComponent(() => m.TabBCRA))
      .catch(() => setComponent(() => BCRAError))
  }, [])

  if (!Component) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--font-data)", color: "var(--text-mute)", fontSize: 11 }}>
      BCRA — CARGANDO...
    </div>
  )
  return <Component initialSubtab={initialSubtab} />
}

function TabNoticias() { return <NewsFeed /> }

export function Dashboard({ initialTab = "macro", initialSubtab = null, embedded = false }: { initialTab?: string; initialSubtab?: string | null; embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [macroSubtab, setMacroSubtab] = useState<string | null>(initialTab === "macro" ? initialSubtab : null)
  const [financeSubtab, setFinanceSubtab] = useState<string | null>(initialTab === "finanzas" ? initialSubtab : null)
  const [bcraSubtab, setBcraSubtab] = useState<string | null>(initialTab === "bcra" ? initialSubtab : null)
  const [searchOpen, setSearchOpen] = useState(false)
  const macroRef = useRef<{ setSubtab?: (s: string) => void }>({})

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setSearchOpen(true); return
      }
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault(); setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    setActiveTab(initialTab)
    setMacroSubtab(initialTab === "macro" ? initialSubtab : null)
    setFinanceSubtab(initialTab === "finanzas" ? initialSubtab : null)
    setBcraSubtab(initialTab === "bcra" ? initialSubtab : null)
  }, [initialSubtab, initialTab])

  const handleNavigate = useCallback((tab: string, subtab?: string | null, bcra?: string | null) => {
    setActiveTab(tab)
    if (tab === "macro") setMacroSubtab(subtab ?? null)
    if (tab === "finanzas") setFinanceSubtab(subtab ?? null)
    if (tab === "bcra") setBcraSubtab(subtab ?? null)
    if (bcra !== undefined) setBcraSubtab(bcra)
  }, [])

  const now = new Date()
  const dateStr = now
    .toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase()

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", overflowX: "hidden" }}>
      <TickerTape />

      <div style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        height: 56, display: "flex", alignItems: "center",
        padding: "0 24px", gap: 24,
        position: "sticky", top: embedded ? 48 : 0, zIndex: 50,
      }}>
        {!embedded && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: "var(--amber)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--bg)", fontFamily: "var(--font-ui)", lineHeight: 1 }}>L</span>
              </div>
              <span style={{
                fontSize: 15, fontWeight: 600, color: "var(--text)",
                letterSpacing: -0.2, fontFamily: "var(--font-ui)",
              }}>La Pizarra</span>
            </div>

            <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />
          </>
        )}

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
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? "var(--text)" : "var(--text-dim)",
                  background: "transparent", border: "none",
                  borderBottom: active ? "2px solid var(--amber)" : "2px solid transparent",
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "color 0.15s, border-color 0.15s",
                  fontFamily: "var(--font-ui)",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text)" }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "var(--text-dim)" }}
              >
                <Icon size={14} strokeWidth={active ? 2.2 : 1.6} />
                {label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setSearchOpen(true)}
          title="Buscar indicador (⌘K)"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: 280, height: 34,
            background: "var(--bg-elev)", border: "1px solid var(--border)",
            borderRadius: 7, cursor: "text",
            padding: "0 12px", textAlign: "left", flexShrink: 0,
          }}
        >
          <Search size={13} strokeWidth={1.8} style={{ color: "var(--text-mute)", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "var(--text-mute)", fontFamily: "var(--font-ui)", flex: 1 }}>
            Buscar indicador…
          </span>
          <span style={{
            fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-data)",
            background: "var(--bg-elev-2)", padding: "2px 6px", borderRadius: 4,
            border: "1px solid var(--border)",
          }}>⌘K</span>
        </button>

        {!embedded && (
          <>
            <ThemeToggle />
            <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-data)", flexShrink: 0 }}>
              {dateStr}
            </span>
          </>
        )}
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 8px" }}>
        {activeTab === "resumen"   && <TabResumen onNavigate={handleNavigate} />}
        {activeTab === "finanzas"  && <TabFinanzas initialSubtab={financeSubtab} />}
        {activeTab === "macro"     && <TabMacro initialSubtab={macroSubtab} />}
        {activeTab === "bcra"      && <TabBCRALazy initialSubtab={bcraSubtab} />}
        {activeTab === "noticias"  && <TabNoticias />}
      </div>

      <CommandPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
