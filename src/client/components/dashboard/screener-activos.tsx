"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Plus, Search, X } from "lucide-react"
import { Input } from "@/client/components/ui/input"
import { cn } from "@/lib/utils"
import { WATCHLIST_DEFAULT, WATCHLIST_EVENT, readWatchlist, writeWatchlist } from "@/lib/watchlist"
import { useTickerNav } from "@/lib/ticker-nav"

interface AssetRow {
  id: string
  ticker: string
  name: string
  market: string
  currency: "ARS" | "USD" | "Índice"
  price: number | null
  change: number | null
}

interface StockQuote {
  ticker: string
  category: string
  lastPrice: number | null
  change1D: number | null
}

interface BondQuote {
  ticker: string
  nombre: string
  precio: number | null
}

interface LecapQuote {
  ticker: string
  tipo: string
  precio: number | null
}

interface WorldQuote {
  precio: number
  variacion_pct: number
  ticker: string
}

interface UsaStockQuote {
  ticker: string
  name: string
  sector: string
  lastPrice: number | null
  change1DPct: number | null
}

function number(value: number | null, suffix = "") {
  return value == null ? "—" : `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}${suffix}`
}

// Columnas ordenables del screener. `key` null = columna sin sort (checkbox).
type SortKey = "ticker" | "market" | "currency" | "price" | "change"
const HEADERS: { label: string; key: SortKey | null; align: "left" | "right" | "center" }[] = [
  { label: "", key: null, align: "center" },
  { label: "Ticker", key: "ticker", align: "left" },
  { label: "Mercado", key: "market", align: "left" },
  { label: "Moneda", key: "currency", align: "right" },
  { label: "Último", key: "price", align: "right" },
  { label: "Var. 1D", key: "change", align: "right" },
]

export function AssetScreener() {
  const [rows, setRows] = useState<AssetRow[]>([])
  const [selected, setSelected] = useState<string[]>(WATCHLIST_DEFAULT)
  const [query, setQuery] = useState("")
  const [currency, setCurrency] = useState<"ALL" | "ARS" | "USD">("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const { navigateToTicker } = useTickerNav()

  // Hidratar desde localStorage y sincronizar en vivo con otras vistas que
  // toquen la watchlist (ej. el screener de bonos con "Agregar al monitor").
  useEffect(() => {
    setSelected(readWatchlist())
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail
      setSelected(Array.isArray(detail) ? detail : readWatchlist())
    }
    window.addEventListener(WATCHLIST_EVENT, onChange)
    return () => window.removeEventListener(WATCHLIST_EVENT, onChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      fetch("/api/acciones?category=all").then((response) => response.json()),
      fetch("/api/bonos").then((response) => response.json()),
      fetch("/api/bonos?tipo=lecap").then((response) => response.json()),
      fetch("/api/mundo").then((response) => response.json()),
      fetch("/api/usa-stocks").then((response) => response.json()),
    ]).then(([stocksResult, bondsResult, lecapsResult, worldResult, usaResult]) => {
      if (cancelled) return
      const next: AssetRow[] = []
      if (stocksResult.status === "fulfilled") {
        const byCategory = stocksResult.value?.data?.byCategory as Record<string, StockQuote[]> | undefined
        Object.values(byCategory ?? {}).flat().forEach((item) => next.push({ id: `accion:${item.ticker}`, ticker: item.ticker, name: item.category, market: "Acciones ARG", currency: "ARS", price: item.lastPrice, change: item.change1D }))
      }
      if (bondsResult.status === "fulfilled" && Array.isArray(bondsResult.value?.data)) {
        ;(bondsResult.value.data as BondQuote[]).forEach((item) => next.push({ id: `bono:${item.ticker}`, ticker: item.ticker, name: item.nombre, market: "Bonos USD", currency: "USD", price: item.precio, change: null }))
      }
      if (lecapsResult.status === "fulfilled" && Array.isArray(lecapsResult.value?.data)) {
        ;(lecapsResult.value.data as LecapQuote[]).forEach((item) => next.push({ id: `lecap:${item.ticker}`, ticker: item.ticker, name: item.tipo, market: "Letras", currency: "ARS", price: item.precio, change: null }))
      }
      if (worldResult.status === "fulfilled" && worldResult.value?.data) {
        Object.entries(worldResult.value.data as Record<string, WorldQuote | null>).forEach(([key, item]) => {
          if (!item) return
          next.push({ id: `mundo:${key.toUpperCase()}`, ticker: key.toUpperCase(), name: item.ticker, market: "Global", currency: "Índice", price: item.precio, change: item.variacion_pct })
        })
      }
      if (usaResult.status === "fulfilled" && Array.isArray(usaResult.value?.data)) {
        ;(usaResult.value.data as UsaStockQuote[]).forEach((item) => next.push({
          id: `accion_usa:${item.ticker}`,
          ticker: item.ticker,
          name: item.name,
          market: `S&P 500 · ${item.sector}`,
          currency: "USD",
          price: item.lastPrice,
          change: item.change1DPct,
        }))
      }
      setRows(Array.from(new Map(next.map((item) => [item.id, item])).values()))
      if (next.length === 0) setError("No se pudieron obtener instrumentos")
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es")
    const filtered = rows.filter((row) => {
      if (currency !== "ALL" && row.currency !== currency) return false
      return !normalized || `${row.ticker} ${row.name} ${row.market}`.toLocaleLowerCase("es").includes(normalized)
    })
    if (!sortKey) return filtered
    const dir = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      // Nulos siempre al fondo, sin importar la dirección
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
      return String(av).localeCompare(String(bv), "es") * dir
    })
  }, [currency, query, rows, sortKey, sortDir])
  const selectedRows = selected.map((id) => rows.find((row) => row.id === id)).filter((row): row is AssetRow => Boolean(row))

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      writeWatchlist(next)
      return next
    })
  }

  return (
    <div className="min-h-full bg-[var(--bg)] p-3 text-[var(--text)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1"><Search size={14} className="absolute left-3 top-2.5 text-[var(--text-mute)]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ticker o instrumento…" className="h-9 pl-9" /></div>
        <div className="flex gap-1">{(["ALL", "ARS", "USD"] as const).map((item) => <button key={item} onClick={() => setCurrency(item)} className={cn("h-9 rounded-md border px-3 font-mono text-[10px]", currency === item ? "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]" : "border-[var(--border)] text-[var(--text-dim)]")}>{item === "ALL" ? "Todos" : item}</button>)}</div>
      </div>

      {selectedRows.length > 0 && (
        <div className="mb-3 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-2">
          <div className="mb-2 text-[9px] uppercase tracking-widest text-[var(--text-mute)]">Mi screener · {selectedRows.length} instrumentos</div>
          <div className="flex flex-wrap gap-1.5">{selectedRows.map((row) => <button key={row.id} onClick={() => toggle(row.id)} className="flex items-center gap-1 rounded-full border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-2.5 py-1 font-mono text-[10px] text-[var(--amber)]">{row.ticker}<X size={10} /></button>)}</div>
        </div>
      )}

      {loading ? <div className="p-10 text-center font-mono text-xs text-[var(--text-dim)]">Cargando instrumentos…</div> : error ? <div className="p-8 text-center text-xs text-[var(--negative)]">{error}</div> : (
        <div className="overflow-auto rounded-md border border-[var(--border)]">
          <table className="w-full min-w-[620px] border-collapse font-mono text-[10px]">
            <thead className="sticky top-0 bg-[var(--bg-elev)] text-[var(--text-mute)]"><tr>{HEADERS.map((h) => (
              <th
                key={h.label || "check"}
                onClick={h.key ? () => toggleSort(h.key!) : undefined}
                className={cn(
                  "border-b border-[var(--border)] px-2 py-2 font-normal",
                  h.align === "left" ? "text-left" : h.align === "center" ? "text-center" : "text-right",
                  h.key && "cursor-pointer select-none hover:text-[var(--text)]",
                )}
              >
                {h.label}
                {h.key && sortKey === h.key && <span className="ml-0.5 text-[var(--amber)]">{sortDir === "asc" ? "▲" : "▼"}</span>}
              </th>
            ))}</tr></thead>
            <tbody>{matches.map((row) => {
              const active = selected.includes(row.id)
              // id formato "accion:GGAL" | "accion_usa:AAPL" | "bono:AL30" | "lecap:S31E5" | "mundo:SP500"
              const colonIdx = row.id.indexOf(":")
              const rawKind   = row.id.slice(0, colonIdx)
              const rawTicker = row.id.slice(colonIdx + 1)
              const canOpenEmpresa = rawKind === "accion" || rawKind === "accion_usa" || rawKind === "bono"
              return <tr
                key={row.id}
                className={cn(
                  "border-b border-[var(--border)] hover:bg-[var(--bg-elev-2)]",
                  active && "bg-[var(--amber-soft)]/40",
                  canOpenEmpresa && "cursor-pointer",
                )}
                onClick={canOpenEmpresa ? () => navigateToTicker(
                  rawKind === "bono" ? "bono" : rawKind === "accion_usa" ? "accion_usa" : "accion",
                  rawTicker,
                  "empresa",
                ) : undefined}
              >
                <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggle(row.id)} title={active ? "Quitar" : "Agregar"} className={cn("inline-flex h-5 w-5 items-center justify-center rounded border", active ? "border-[var(--amber)] text-[var(--amber)]" : "border-[var(--border-hi)] text-[var(--text-mute)]")} >{active ? <Check size={11} /> : <Plus size={11} />}</button>
                </td>
                <td className="px-2 py-2 text-left font-bold text-[var(--amber)]"><div>{row.ticker}</div><div className="max-w-44 truncate font-sans text-[8px] font-normal text-[var(--text-mute)]">{row.name}</div></td>
                <td className="px-2 py-2 text-left text-[var(--text-dim)]">{row.market}</td><td className="px-2 py-2 text-right text-[var(--text-dim)]">{row.currency}</td><td className="px-2 py-2 text-right">{number(row.price)}</td>
                <td className={cn("px-2 py-2 text-right font-semibold", row.change == null ? "text-[var(--text-mute)]" : row.change >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]")}>{number(row.change, "%")}</td>
              </tr>
            })}</tbody>
          </table>
          {matches.length === 0 && <div className="p-8 text-center text-xs text-[var(--text-dim)]">No hay instrumentos para ese filtro.</div>}
        </div>
      )}
      <div className="pt-2 font-mono text-[8px] text-[var(--text-mute)]">Configuración guardada en este navegador · Acciones, renta fija local y mercados globales.</div>
    </div>
  )
}
