"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Database, Search } from "lucide-react"
import { Input } from "@/client/components/ui/input"
import { DataCardRenderer } from "./data-card-renderer"
import { DATA_CARD_CATALOG, searchDataCards } from "@/lib/card-catalog"
import { libraryCardIdForTickerFocus, type TickerFocus } from "@/lib/ticker-nav"

export function DataLibrary({ focusTicker = null }: { focusTicker?: TickerFocus | null }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState("emae")
  const selected = DATA_CARD_CATALOG.find((item) => item.id === selectedId) ?? DATA_CARD_CATALOG[0]
  const focusCardId = libraryCardIdForTickerFocus(focusTicker)

  useEffect(() => {
    if (focusCardId) setSelectedId(focusCardId)
  }, [focusCardId])

  useEffect(() => {
    if (!focusCardId || selectedId !== focusCardId) return
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-library-card-id="${focusCardId}"]`)
      target?.scrollIntoView({ block: "center", inline: "nearest" })
      target?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusCardId, selectedId])

  const results = useMemo(() => query.trim() ? searchDataCards(query).slice(0, 10) : [], [query])

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <div className="mx-auto max-w-[1384px]">
          <div className="relative max-w-2xl">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-[var(--text-mute)]" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar entre todas las tarjetas e indicadores…" className="pl-9" />
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-[90] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedId(item.id); setQuery("") }}
                    className="flex w-full items-center gap-3 border-b border-[var(--border-light)] px-3 py-2 text-left last:border-0 hover:bg-[var(--bg-elev-2)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-[var(--text)]">{item.title}</div>
                      <div className="truncate text-[10px] text-[var(--text-dim)]">{item.description}</div>
                    </div>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[8px] uppercase text-[var(--text-mute)]">{item.category}</span>
                    <ArrowRight size={13} className="text-[var(--amber)]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <main className="mx-auto grid w-full max-w-[1384px] gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Database size={17} className="text-[var(--amber)]" />
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">Biblioteca de datos</h1>
            <p className="text-xs text-[var(--text-dim)]">Previews con el mismo boundary numérico y provenance que Mi Pizarra.</p>
          </div>
        </div>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <section
            className="bbg-panel min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-3"
            aria-label="Preview de tarjeta"
            tabIndex={-1}
            data-library-focus-ticker={focusTicker?.ticker ?? undefined}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[var(--text)]">{selected.title}</h2>
                <p className="truncate text-[10px] text-[var(--text-dim)]">{selected.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[9px] uppercase text-[var(--text-mute)]">{selected.category}</span>
            </div>
            <div data-library-card-id={selected.id} tabIndex={-1} className="min-h-32 min-w-0 overflow-hidden">
              <DataCardRenderer cardId={selected.id} focusTicker={selected.id === focusCardId ? focusTicker : null} />
            </div>
          </section>
          <aside className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-3" aria-label="Catálogo de Biblioteca">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">Catálogo</h2>
              <span className="font-mono text-[10px] text-[var(--text-mute)]">{DATA_CARD_CATALOG.length} tarjetas</span>
            </div>
            <div className="max-h-[32rem] overflow-y-auto pr-1">
              {DATA_CARD_CATALOG.map((item) => (
                <button key={item.id} onClick={() => setSelectedId(item.id)} className={`mb-1 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left ${selectedId === item.id ? "border-[var(--amber)] bg-[var(--amber-soft)]" : "border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-elev-2)]"}`}>
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--text)]">{item.title}</span>
                  <ArrowRight size={12} className="shrink-0 text-[var(--amber)]" />
                </button>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
