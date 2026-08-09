"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import GridLayout, { type Layout, useContainerWidth } from "react-grid-layout"
import { Copy, GripHorizontal, LayoutGrid, MessageCircle, Plus, Search, Trash2, X } from "lucide-react"
import { Button } from "@/client/components/ui/button"
import { CardDiscussionProvider } from "@/client/components/ui/card-discussion-context"
import { Input } from "@/client/components/ui/input"
import { ForoActivo } from "@/client/components/dashboard/foro-activo"
import { CardHealthBadge } from "./card-health-badge"
import { DataCardRenderer } from "./data-card-renderer"
import { CARD_CATEGORIES, DATA_CARD_BY_ID, searchDataCards, type CardCategory } from "@/lib/card-catalog"
import { cn } from "@/lib/utils"

interface CanvasWidget {
  instanceId: string
  cardId: string
  x: number
  y: number
  w: number
  h: number
}

interface CanvasSheet {
  id: string
  name: string
  widgets: CanvasWidget[]
}

const STORAGE_KEY = "lapizarra.canvas.sheets.v2"
const ACTIVE_KEY = "lapizarra.canvas.active-sheet.v2"

function uid(prefix: string) {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`
}

function initialSheets(): CanvasSheet[] {
  return [{
    id: "mi-pizarra",
    name: "Mi Pizarra",
    widgets: [
      { instanceId: "inicio-tipo-cambio", cardId: "resumen-tipo-cambio", x: 0, y: 0, w: 12, h: 7 },
      { instanceId: "inicio-riesgo", cardId: "resumen-riesgo", x: 0, y: 7, w: 4, h: 6 },
      { instanceId: "inicio-reservas", cardId: "resumen-reservas", x: 4, y: 7, w: 4, h: 7 },
      { instanceId: "inicio-rem", cardId: "rem", x: 8, y: 7, w: 4, h: 10 },
    ],
  }]
}

function isValidStoredSheets(value: unknown): value is CanvasSheet[] {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every((sheet) => sheet && typeof sheet.id === "string" && typeof sheet.name === "string" && Array.isArray(sheet.widgets))
}

export function CanvasWorkspace() {
  const [sheets, setSheets] = useState<CanvasSheet[]>(initialSheets)
  const [activeId, setActiveId] = useState("mi-pizarra")
  const [catalogOpen, setCatalogOpen] = useState(true)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<CardCategory | "all">("all")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [chatWidgetId, setChatWidgetId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const { width, containerRef, mounted } = useContainerWidth()

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
      if (isValidStoredSheets(stored)) setSheets(stored)
      const storedActive = localStorage.getItem(ACTIVE_KEY)
      if (storedActive) setActiveId(storedActive)
    } catch {
      // A corrupt local draft should never block the workspace.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setCatalogOpen(false)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheets))
    localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId, hydrated, sheets])

  useEffect(() => {
    if (!sheets.some((sheet) => sheet.id === activeId)) setActiveId(sheets[0]?.id ?? "")
  }, [activeId, sheets])

  const activeSheet = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0]
  const results = useMemo(() => searchDataCards(query, category), [query, category])
  const compactLayout = mounted && width < 720

  const updateActiveWidgets = useCallback((updater: (widgets: CanvasWidget[]) => CanvasWidget[]) => {
    setSheets((current) => current.map((sheet) => sheet.id === activeId ? { ...sheet, widgets: updater(sheet.widgets) } : sheet))
  }, [activeId])

  const handleLayoutChange = useCallback((layout: Layout) => {
    const positions = new Map(layout.map((item) => [item.i, item]))
    updateActiveWidgets((widgets) => widgets.map((widget) => {
      const item = positions.get(widget.instanceId)
      return item ? { ...widget, x: item.x, y: item.y, w: item.w, h: item.h } : widget
    }))
  }, [updateActiveWidgets])

  function addWidget(cardId: string) {
    const definition = DATA_CARD_BY_ID.get(cardId)
    if (!definition) return
    const bottom = activeSheet.widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0)
    updateActiveWidgets((widgets) => [...widgets, {
      instanceId: uid(cardId), cardId,
      x: 0, y: bottom,
      w: definition.defaultW, h: definition.defaultH,
    }])
  }

  function addSheet() {
    const id = uid("hoja")
    setSheets((current) => [...current, { id, name: `Hoja ${current.length + 1}`, widgets: [] }])
    setActiveId(id)
    setEditingId(id)
  }

  function duplicateSheet() {
    if (!activeSheet) return
    const id = uid("hoja")
    setSheets((current) => [...current, {
      id,
      name: `${activeSheet.name} copia`,
      widgets: activeSheet.widgets.map((widget) => ({ ...widget, instanceId: uid(widget.cardId) })),
    }])
    setActiveId(id)
  }

  function deleteSheet() {
    if (sheets.length === 1) return
    const index = sheets.findIndex((sheet) => sheet.id === activeId)
    const next = sheets.filter((sheet) => sheet.id !== activeId)
    setSheets(next)
    setActiveId(next[Math.max(0, index - 1)]?.id ?? next[0].id)
  }

  if (!activeSheet) return null

  const layout: Layout = activeSheet.widgets.map((widget) => {
    const definition = DATA_CARD_BY_ID.get(widget.cardId)
    return {
      i: widget.instanceId,
      x: compactLayout ? 0 : widget.x,
      y: widget.y,
      w: compactLayout ? 1 : widget.w,
      h: widget.h,
      minW: compactLayout ? 1 : definition?.minW ?? 4,
      minH: definition?.minH ?? 6,
    }
  })

  return (
    <div className="min-h-[calc(100vh-49px)] bg-[var(--bg)]">
      <div className="sticky top-12 z-[65] flex min-h-12 items-center gap-2 border-b border-[var(--border)] bg-[color:var(--bg-elev)]/95 px-3 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
          {sheets.map((sheet) => (
            editingId === sheet.id ? (
              <Input
                key={sheet.id}
                autoFocus
                value={sheet.name}
                className="h-8 w-36 shrink-0"
                onChange={(event) => setSheets((current) => current.map((item) => item.id === sheet.id ? { ...item, name: event.target.value } : item))}
                onBlur={() => setEditingId(null)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") setEditingId(null) }}
              />
            ) : (
              <button
                key={sheet.id}
                onClick={() => setActiveId(sheet.id)}
                onDoubleClick={() => setEditingId(sheet.id)}
                className={cn(
                  "h-8 shrink-0 rounded-md border px-3 text-xs transition-colors",
                  activeId === sheet.id
                    ? "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]"
                    : "border-transparent text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
                )}
              >
                {sheet.name}
              </button>
            )
          ))}
          <Button variant="ghost" size="icon" onClick={addSheet} className="h-8 w-8 shrink-0 text-[var(--text-dim)]" title="Nueva hoja"><Plus size={15} /></Button>
        </div>
        <Button variant="ghost" size="icon" onClick={duplicateSheet} className="h-8 w-8 text-[var(--text-dim)]" title="Duplicar hoja"><Copy size={14} /></Button>
        <Button variant="ghost" size="icon" onClick={deleteSheet} disabled={sheets.length === 1} className="h-8 w-8 text-[var(--text-dim)]" title="Eliminar hoja"><Trash2 size={14} /></Button>
        <Button variant="outline" size="sm" onClick={() => setCatalogOpen((value) => !value)} className="h-8 border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text)]">
          <LayoutGrid size={14} className="mr-2" />Tarjetas
        </Button>
      </div>

      <div className="flex items-start">
        <section ref={containerRef} className="min-w-0 flex-1 p-2">
          {activeSheet.widgets.length === 0 && (
            <button onClick={() => setCatalogOpen(true)} className="m-4 flex min-h-72 w-[calc(100%-2rem)] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-hi)] text-[var(--text-dim)] hover:border-[var(--amber)] hover:text-[var(--text)]">
              <LayoutGrid size={28} className="mb-3 text-[var(--amber)]" />
              <span className="font-medium">Esta hoja está vacía</span>
              <span className="mt-1 text-xs">Abrí el catálogo y agregá tu primera tarjeta.</span>
            </button>
          )}
          {mounted && activeSheet.widgets.length > 0 && (
            <GridLayout
              width={width}
              layout={layout}
              gridConfig={{ cols: compactLayout ? 1 : 12, rowHeight: 44, margin: [10, 10], containerPadding: [0, 0] }}
              dragConfig={{ enabled: !compactLayout, handle: ".canvas-card-handle", cancel: ".canvas-card-interactive" }}
              resizeConfig={{ enabled: !compactLayout, handles: ["se"] }}
              onLayoutChange={compactLayout ? undefined : handleLayoutChange}
            >
              {activeSheet.widgets.map((widget) => {
                const definition = DATA_CARD_BY_ID.get(widget.cardId)
                if (!definition) return <div key={widget.instanceId} />
                return (
                  <div key={widget.instanceId} className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-sm">
                    <div className="canvas-card-handle flex h-10 cursor-grab items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-elev)] px-3 active:cursor-grabbing">
                      <GripHorizontal size={15} className="shrink-0 text-[var(--text-mute)]" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text)]">{definition.title}</span>
                      <CardHealthBadge cardId={definition.id} />
                      <Button
                        variant="ghost" size="icon"
                        className={cn("canvas-card-interactive h-7 w-7", chatWidgetId === widget.instanceId ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "text-[var(--text-dim)] hover:text-[var(--amber)]")}
                        onClick={() => setChatWidgetId((current) => current === widget.instanceId ? null : widget.instanceId)}
                        title={`Conversar sobre ${definition.title}`}
                      ><MessageCircle size={13} /></Button>
                      <Button
                        variant="ghost" size="icon"
                        className="canvas-card-interactive h-7 w-7 text-[var(--text-dim)] hover:text-[var(--negative)]"
                        onClick={() => updateActiveWidgets((widgets) => widgets.filter((item) => item.instanceId !== widget.instanceId))}
                        title="Quitar tarjeta"
                      ><X size={13} /></Button>
                    </div>
                    <div className="canvas-card-interactive h-[calc(100%-2.5rem)] overflow-auto bg-[var(--bg)]">
                      <CardDiscussionProvider title={definition.title} open={() => setChatWidgetId(widget.instanceId)}>
                        {chatWidgetId === widget.instanceId ? (
                          <ForoActivo assetType="variable" ticker={definition.id.toUpperCase()} compact />
                        ) : (
                          <DataCardRenderer cardId={definition.id} />
                        )}
                      </CardDiscussionProvider>
                    </div>
                  </div>
                )
              })}
            </GridLayout>
          )}
        </section>

        {catalogOpen && (
          <aside className="sticky top-24 z-[70] h-[calc(100vh-6rem)] w-80 max-w-full shrink-0 overflow-hidden border-l border-[var(--border)] bg-[var(--bg-elev)] max-lg:fixed max-lg:right-0">
            <div className="border-b border-[var(--border)] p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-[var(--text-mute)]" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarjeta…" className="pl-9" />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setCatalogOpen(false)} className="h-9 w-9 text-[var(--text-dim)]"><X size={15} /></Button>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                <button onClick={() => setCategory("all")} className={cn("rounded-full border px-2 py-1 text-[9px] uppercase tracking-wide", category === "all" ? "border-[var(--amber)] text-[var(--amber)]" : "border-[var(--border)] text-[var(--text-dim)]")}>Todas</button>
                {CARD_CATEGORIES.map((item) => (
                  <button key={item.id} onClick={() => setCategory(item.id)} className={cn("rounded-full border px-2 py-1 text-[9px] uppercase tracking-wide", category === item.id ? "border-[var(--amber)] text-[var(--amber)]" : "border-[var(--border)] text-[var(--text-dim)]")}>{item.label}</button>
                ))}
              </div>
            </div>
            <div className="h-[calc(100%-6.5rem)] overflow-y-auto p-2">
              <div className="px-2 py-1 text-[10px] text-[var(--text-mute)]">{results.length} tarjetas programables</div>
              {results.map((definition) => (
                <div key={definition.id} className="group mb-1 rounded-md border border-transparent p-2 hover:border-[var(--border)] hover:bg-[var(--bg-elev-2)]">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--text)]">{definition.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[var(--text-dim)]">{definition.description}</div>
                      <div className="mt-2 flex items-center gap-2"><CardHealthBadge cardId={definition.id} compact auto={false} /><span className="font-mono text-[9px] text-[var(--text-mute)]">{definition.endpoints.length} endpoint{definition.endpoints.length === 1 ? "" : "s"}</span></div>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => addWidget(definition.id)} className="h-8 w-8 shrink-0 border-[var(--border)] bg-[var(--bg-elev)] text-[var(--amber)]" title={`Agregar ${definition.title}`}><Plus size={14} /></Button>
                  </div>
                </div>
              ))}
              {results.length === 0 && <div className="p-6 text-center text-xs text-[var(--text-dim)]">No hay tarjetas para esa búsqueda.</div>}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
