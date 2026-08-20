"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Search } from "lucide-react"
import { Dashboard } from "@/client/components/dashboard/main-dashboard"
import { Input } from "@/client/components/ui/input"
import { DATA_CARD_CATALOG, searchDataCards } from "@/lib/card-catalog"
import type { TickerFocus } from "@/lib/ticker-nav"

/** kind del cross-link -> {tab, subtab} de Finanzas donde vive ese ticker. */
const FINANZAS_SUBTAB_POR_KIND: Record<"accion" | "bono" | "cap", string> = { accion: "acciones", bono: "bonos", cap: "bonos" }

export function DataLibrary({ focusTicker = null }: { focusTicker?: TickerFocus | null }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState("emae")
  const [override, setOverride] = useState<{ tab: string; subtab: string; ticker: string } | null>(null)

  useEffect(() => {
    if (focusTicker && focusTicker.kind !== "variable") {
      setOverride({ tab: "finanzas", subtab: FINANZAS_SUBTAB_POR_KIND[focusTicker.kind], ticker: focusTicker.ticker })
    }
  }, [focusTicker])

  const selected = override ?? DATA_CARD_CATALOG.find((item) => item.id === selectedId) ?? DATA_CARD_CATALOG[0]
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
                    onClick={() => { setOverride(null); setSelectedId(item.id); setQuery("") }}
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
      <Dashboard key={`${selected.tab}-${selected.subtab ?? "root"}-${override?.ticker ?? (selected as { id?: string }).id}`} initialTab={selected.tab} initialSubtab={selected.subtab} initialTicker={override?.ticker ?? null} embedded />
    </div>
  )
}
