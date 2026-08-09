/**
 * TabForo — HUB de la comunidad
 *
 * Vista central del foro de La Pizarra. Funciona en dos modos:
 *   1) HUB (por defecto): lista de todos los activos que tienen foro, agrupados
 *      por tipo (Acciones / Bonos / LECAPs), con el 💬 conteo de posts y un
 *      bloque destacado con los "más activos" de las últimas 24h.
 *   2) DETALLE: al clickear un activo se abre SU foro reutilizando el componente
 *      existente <ForoActivo>, con un botón "← Volver al foro" para regresar.
 *
 * APIs consumidas:
 *   /api/foro/counts   → { counts: { "accion:GGAL": 3, "bono:AL30": 5, ... } }
 *   /api/foro/trending → { data: [{ assetType, ticker, posts }], hours }
 */

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { MessageSquare, Search, Flame, ArrowLeft } from "lucide-react"
import { ForoActivo } from "./foro-activo"

// ── Tipos ───────────────────────────────────────────────────────────────────

// Los tres tipos de activo que maneja el foro (ver ForoActivo + esquema Prisma)
type AssetType = "accion" | "bono" | "cap"

interface TrendingItem {
  assetType: AssetType
  ticker: string
  posts: number
}

// Un activo con foro, ya parseado desde el mapa de counts
interface AssetRow {
  assetType: AssetType
  ticker: string
  count: number
}

// ── Metadatos de cada tipo (etiqueta singular/plural para agrupar) ──────────

const TYPE_META: Record<AssetType, { label: string; plural: string }> = {
  accion: { label: "Acción", plural: "Acciones" },
  bono:   { label: "Bono",   plural: "Bonos" },
  cap:    { label: "LECAP",  plural: "LECAPs" },
}

// Orden fijo de las secciones del hub
const TYPE_ORDER: AssetType[] = ["accion", "bono", "cap"]

function isAssetType(v: string): v is AssetType {
  return v === "accion" || v === "bono" || v === "cap"
}

// ── KPI card (mismo look que tab-finanzas / tab-macro) ──────────────────────

function KPI({ label, value, unit, valueColor = "var(--text)" }: {
  label: string; value: string | null; unit?: string; valueColor?: string
}) {
  return (
    <div style={{
      flex: "1 1 150px", padding: "10px 14px",
      background: "var(--bg-row-alt)", border: "1px solid var(--bg-elev-2)",
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor, fontFamily: "var(--font-data)", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      {unit && <div style={{ fontSize: 8, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>{unit}</div>}
    </div>
  )
}

// ── Encabezado de sección (mismo look que SectionHeader de tab-macro) ───────

function SectionHeader({ title, source }: { title: string; source?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", background: "var(--bg-elev-2)",
      borderTop: "2px solid var(--border)", borderBottom: "1px solid var(--border)", marginTop: 8,
    }}>
      <span style={{ fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
        {title}
      </span>
      {source && (
        <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>{source}</span>
      )}
    </div>
  )
}

// ── Card de un activo (clicable → abre su foro) ─────────────────────────────

function AssetCard({ row, onOpen }: { row: AssetRow; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        flex: "1 1 150px", minWidth: 130,
        background: "var(--bg-row-alt)", border: "1px solid var(--bg-elev-2)",
        borderRadius: 3, padding: "9px 12px", cursor: "pointer", textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
        fontFamily: "var(--font-data)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,160,40,0.4)";
        (e.currentTarget as HTMLElement).style.background = "var(--bg-elev)"
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-elev-2)";
        (e.currentTarget as HTMLElement).style.background = "var(--bg-row-alt)"
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {row.ticker}
        </span>
        <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>
          {TYPE_META[row.assetType].label}
        </span>
      </div>
      <span style={{
        display: "flex", alignItems: "center", gap: 3, flexShrink: 0,
        fontSize: 10, color: "var(--text-dim)",
        background: "var(--bg-elev-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "1px 7px",
      }}>
        💬 {row.count}
      </span>
    </button>
  )
}

// ── Chip de un activo trending (más activos 24h) ────────────────────────────

function TrendingChip({ item, onOpen }: { item: TrendingItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(255,160,40,0.08)", border: "1px solid rgba(255,160,40,0.4)",
        borderRadius: 20, padding: "5px 12px", cursor: "pointer",
        fontFamily: "var(--font-data)", whiteSpace: "nowrap", transition: "all 0.15s",
      }}
    >
      <Flame size={11} strokeWidth={2} style={{ color: "var(--amber)", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)" }}>{item.ticker}</span>
      <span style={{ fontSize: 9, color: "var(--text-dim)" }}>
        {TYPE_META[item.assetType].label} · 💬 {item.posts}
      </span>
    </button>
  )
}

// ── Componente principal ────────────────────────────────────────────────────

export function TabForo() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  // Filtro por tipo: "all" o uno de los AssetType
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all")
  // Activo seleccionado → cambia a la vista de detalle (foro del activo)
  const [selected, setSelected] = useState<{ assetType: AssetType; ticker: string } | null>(null)

  // Carga de datos: conteos + trending de las últimas 24h
  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch("/api/foro/counts").then(r => r.json()).catch(() => ({ counts: {} })),
      fetch("/api/foro/trending?hours=24&limit=8").then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([c, t]) => {
      setCounts(c.counts ?? {})
      const items: TrendingItem[] = Array.isArray(t.data)
        ? t.data
            .filter((d: { assetType?: string }) => typeof d.assetType === "string" && isAssetType(d.assetType))
            .map((d: { assetType: AssetType; ticker: string; posts: number }) => ({
              assetType: d.assetType, ticker: d.ticker, posts: d.posts,
            }))
        : []
      setTrending(items)
    }).finally(() => setLoading(false))
  }, [])

  // Parsea el mapa "tipo:ticker" → filas de activos con foro
  const allAssets = useMemo<AssetRow[]>(() => {
    const rows: AssetRow[] = []
    for (const [key, count] of Object.entries(counts)) {
      const idx = key.indexOf(":")
      if (idx < 0) continue
      const type = key.slice(0, idx)
      const ticker = key.slice(idx + 1)
      if (!isAssetType(type) || !ticker) continue
      rows.push({ assetType: type, ticker, count })
    }
    return rows
  }, [counts])

  // Resuelve el tipo de un ticker (para las menciones $TICKER dentro de un post)
  const resolveType = useCallback((ticker: string): AssetType => {
    const t = ticker.toUpperCase()
    for (const ty of TYPE_ORDER) {
      if (counts[`${ty}:${t}`] != null) return ty
    }
    return "accion" // fallback razonable si el ticker aún no tiene foro
  }, [counts])

  // Aplica búsqueda por ticker + filtro por tipo, y ordena por cantidad de posts
  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    return allAssets
      .filter(a => typeFilter === "all" || a.assetType === typeFilter)
      .filter(a => !q || a.ticker.toUpperCase().includes(q))
      .sort((a, b) => b.count - a.count)
  }, [allAssets, search, typeFilter])

  // Agrupa el resultado filtrado por tipo, respetando el orden de secciones
  const grouped = useMemo(() => {
    return TYPE_ORDER.map(ty => ({
      type: ty,
      rows: filtered.filter(a => a.assetType === ty),
    })).filter(g => g.rows.length > 0)
  }, [filtered])

  const totalPosts = useMemo(() => allAssets.reduce((s, a) => s + a.count, 0), [allAssets])

  // ── Vista de DETALLE: foro de un activo puntual ───────────────────────────
  if (selected) {
    return (
      <div style={{ paddingBottom: 16 }}>
        <div style={{ padding: "10px 4px 0" }}>
          <button
            onClick={() => setSelected(null)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "1px solid var(--border)", borderRadius: 20,
              color: "var(--text-dim)", cursor: "pointer", padding: "5px 14px",
              fontSize: 10, fontFamily: "var(--font-data)", textTransform: "uppercase", letterSpacing: 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--amber)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-dim)" }}
          >
            <ArrowLeft size={12} strokeWidth={2} />
            Volver al foro
          </button>
        </div>
        <ForoActivo
          assetType={selected.assetType}
          ticker={selected.ticker}
          onTickerClick={(t) => setSelected({ assetType: resolveType(t), ticker: t.toUpperCase() })}
        />
      </div>
    )
  }

  // ── Vista HUB ─────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Encabezado del hub */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 14px 8px",
      }}>
        <MessageSquare size={16} strokeWidth={2} style={{ color: "var(--amber)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "var(--font-data)" }}>
          Foro — Hub de la comunidad
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1, padding: "0 14px 12px" }}>
        <KPI label="Posts totales" value={String(totalPosts)} valueColor="var(--amber)" unit="mensajes publicados" />
        <KPI label="Activos con foro" value={String(allAssets.length)} valueColor="var(--sky)" unit="tickers con conversación" />
        <KPI label="Activos en llamas (24h)" value={String(trending.length)} valueColor="var(--positive)" unit="con actividad reciente" />
      </div>

      {/* Buscador + filtro por tipo */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "10px 14px", background: "var(--bg)", borderTop: "1px solid var(--bg-elev-2)", borderBottom: "1px solid var(--bg-elev-2)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--bg-elev-2)", border: "1px solid var(--border)", borderRadius: 3,
          padding: "0 10px", flex: "1 1 200px", maxWidth: 320,
        }}>
          <Search size={12} strokeWidth={1.8} style={{ color: "var(--text-mute)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar por ticker…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--text)", padding: "6px 0", fontSize: 11, fontFamily: "var(--font-ui)",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 12, padding: 0,
            }}>✕</button>
          )}
        </div>

        {/* Pills de filtro por tipo (mismo look que las SubTabs) */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {([["all", "Todos"], ["accion", "Acciones"], ["bono", "Bonos"], ["cap", "LECAPs"]] as const).map(([key, label]) => {
            const active = typeFilter === key
            return (
              <button key={key} onClick={() => setTypeFilter(key)} style={{
                fontSize: 9, fontFamily: "var(--font-data)", padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: 1,
                background: active ? "rgba(255,160,40,0.12)" : "transparent",
                border: active ? "1px solid rgba(255,160,40,0.4)" : "1px solid var(--border)",
                color: active ? "var(--amber)" : "var(--text-dim)",
              }}>{label}</button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
          Cargando foro…
        </div>
      ) : allAssets.length === 0 ? (
        // Empty state global: nadie comentó nada todavía
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
          <div style={{ fontSize: 12, color: "var(--text)", fontFamily: "var(--font-ui)", marginBottom: 4 }}>
            Todavía no hay comentarios en ningún activo — sé el primero.
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-data)" }}>
            Entrá a un activo desde el tab Finanzas y arrancá la conversación.
          </div>
        </div>
      ) : (
        <>
          {/* Más activos (24h) — solo si el filtro es "Todos" y sin búsqueda */}
          {trending.length > 0 && typeFilter === "all" && !search.trim() && (
            <>
              <SectionHeader title="🔥 Más activos · últimas 24h" source="/api/foro/trending" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 14px" }}>
                {trending.map((item, i) => (
                  <TrendingChip
                    key={`${item.assetType}:${item.ticker}:${i}`}
                    item={item}
                    onOpen={() => setSelected({ assetType: item.assetType, ticker: item.ticker })}
                  />
                ))}
              </div>
            </>
          )}

          {/* Listado agrupado por tipo */}
          {grouped.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 10 }}>
              Sin activos que coincidan con “{search.trim()}”.
            </div>
          ) : (
            grouped.map(g => (
              <div key={g.type}>
                <SectionHeader title={TYPE_META[g.type].plural} source={`${g.rows.length} ${g.rows.length === 1 ? "activo" : "activos"}`} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 14px" }}>
                  {g.rows.map(row => (
                    <AssetCard
                      key={`${row.assetType}:${row.ticker}`}
                      row={row}
                      onOpen={() => setSelected({ assetType: row.assetType, ticker: row.ticker })}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      <div style={{ padding: "6px 14px", fontSize: 8, color: "var(--text-dim)", borderTop: "1px solid var(--bg-elev-2)", fontFamily: "var(--font-data)" }}>
        Fuente: foro La Pizarra · /api/foro/counts + /api/foro/trending · Tocá un activo para abrir su conversación
      </div>
    </div>
  )
}
