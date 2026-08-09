"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Plus, Search, X } from "lucide-react"
import { Input } from "@/client/components/ui/input"
import { cn } from "@/lib/utils"

interface RateRow {
  id: string
  name: string
  ticker: string
  currency: "ARS" | "USD"
  source: string
  term: string
  rate: number | null
  kind: string
}

interface Point { fecha: string; valor: number }
interface BondRate { ticker: string; vencimiento: string; tir: number | null }
interface LecapRate { ticker: string; vencimiento: string; diasVencimiento: number; tir: number | null; tea: number | null; tem: number | null }
interface RofexRate { position: string; maturityLabel: string | null; tna: number | null }

const STORAGE_KEY = "lapizarra.screener.tasas.v1"
const DEFAULT_SELECTION = ["bcra:TAMAR", "bcra:BADLAR", "ust:10Y", "bono:AL30"]
const BCRA_NAMES: Record<string, string> = { tamar: "TAMAR privados", badlar: "BADLAR privados", dep30: "Depósitos a 30 días", adelantos: "Adelantos cuenta corriente", prestamos: "Préstamos personales" }

function latest(points: Point[] | undefined) { return points?.at(-1)?.valor ?? null }
function pct(value: number | null) { return value == null ? "—" : `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%` }

export function RateScreener() {
  const [rows, setRows] = useState<RateRow[]>([])
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION)
  const [query, setQuery] = useState("")
  const [currency, setCurrency] = useState<"ALL" | "ARS" | "USD">("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
      if (Array.isArray(stored) && stored.every((value) => typeof value === "string")) setSelected(stored)
    } catch { /* conservar selección inicial */ }
  }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(selected)) }, [selected])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      fetch("/api/bcra?endpoint=tasas").then((response) => response.json()),
      fetch("/api/ust-curve").then((response) => response.json()),
      fetch("/api/bonos").then((response) => response.json()),
      fetch("/api/bonos?tipo=lecap").then((response) => response.json()),
      fetch("/api/rofex").then((response) => response.json()),
    ]).then(([bcraResult, ustResult, bondsResult, lecapsResult, rofexResult]) => {
      if (cancelled) return
      const next: RateRow[] = []
      if (bcraResult.status === "fulfilled" && bcraResult.value?.data) {
        Object.entries(bcraResult.value.data as Record<string, Point[]>).forEach(([key, points]) => next.push({ id: `bcra:${key.toUpperCase()}`, name: BCRA_NAMES[key] ?? key, ticker: key.toUpperCase(), currency: "ARS", source: "BCRA", term: key === "dep30" ? "30D" : "Referencia", rate: latest(points), kind: "TNA" }))
      }
      if (ustResult.status === "fulfilled" && Array.isArray(ustResult.value?.curve)) {
        ;(ustResult.value.curve as Array<{ label: string; yield: number | null }>).forEach((point) => next.push({ id: `ust:${point.label}`, name: `Treasury ${point.label}`, ticker: `UST ${point.label}`, currency: "USD", source: "US Treasury", term: point.label, rate: point.yield, kind: "Yield" }))
      }
      if (bondsResult.status === "fulfilled" && Array.isArray(bondsResult.value?.data)) {
        ;(bondsResult.value.data as BondRate[]).forEach((bond) => next.push({ id: `bono:${bond.ticker}`, name: `Bono hard dollar ${bond.ticker}`, ticker: bond.ticker, currency: "USD", source: "Bonos soberanos", term: bond.vencimiento, rate: bond.tir, kind: "TIR" }))
      }
      if (lecapsResult.status === "fulfilled" && Array.isArray(lecapsResult.value?.data)) {
        ;(lecapsResult.value.data as LecapRate[]).forEach((lecap) => next.push({ id: `lecap:${lecap.ticker}`, name: `Letra ${lecap.ticker}`, ticker: lecap.ticker, currency: "ARS", source: "Letras Tesoro", term: `${lecap.diasVencimiento}D`, rate: lecap.tea ?? lecap.tir ?? (lecap.tem == null ? null : (Math.pow(1 + lecap.tem / 100, 12) - 1) * 100), kind: "TEA" }))
      }
      if (rofexResult.status === "fulfilled" && Array.isArray(rofexResult.value)) {
        ;(rofexResult.value as RofexRate[]).forEach((future) => next.push({ id: `rofex:${future.position}`, name: `Tasa implícita ${future.position}`, ticker: future.position, currency: "ARS", source: "ROFEX", term: future.maturityLabel ?? "Futuro", rate: future.tna, kind: "TNA implícita" }))
      }
      setRows(next)
      if (next.length === 0) setError("No se pudieron obtener tasas")
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es")
    return rows.filter((row) => (currency === "ALL" || row.currency === currency) && (!normalized || `${row.ticker} ${row.name} ${row.source} ${row.term}`.toLocaleLowerCase("es").includes(normalized)))
  }, [currency, query, rows])
  const selectedRows = selected.map((id) => rows.find((row) => row.id === id)).filter((row): row is RateRow => Boolean(row))
  const maxSelected = Math.max(...selectedRows.map((row) => row.rate ?? 0), 1)

  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }

  return (
    <div className="min-h-full bg-[var(--bg)] p-3 text-[var(--text)]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1"><Search size={14} className="absolute left-3 top-2.5 text-[var(--text-mute)]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tasa, plazo, fuente o ticker…" className="h-9 pl-9" /></div>
        <div className="flex gap-1">{(["ALL", "ARS", "USD"] as const).map((item) => <button key={item} onClick={() => setCurrency(item)} className={cn("h-9 rounded-md border px-3 font-mono text-[10px]", currency === item ? "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]" : "border-[var(--border)] text-[var(--text-dim)]")}>{item === "ALL" ? "Todas" : item}</button>)}</div>
      </div>

      {selectedRows.length > 0 && (
        <div className="mb-3 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="mb-3 flex items-center justify-between"><span className="text-[9px] uppercase tracking-widest text-[var(--text-mute)]">Comparación seleccionada</span><span className="font-mono text-[9px] text-[var(--text-mute)]">{selectedRows.length} tasas</span></div>
          <div className="space-y-2">{selectedRows.map((row) => <div key={row.id} className="grid grid-cols-[90px_minmax(80px,1fr)_65px_18px] items-center gap-2 font-mono text-[9px]"><span className="truncate text-[var(--amber)]">{row.ticker}</span><div className="h-2 overflow-hidden rounded-full bg-[var(--bg-elev-2)]"><div className="h-full rounded-full bg-[var(--amber)]" style={{ width: `${Math.max(1, ((row.rate ?? 0) / maxSelected) * 100)}%` }} /></div><span className="text-right text-[var(--text)]">{pct(row.rate)}</span><button onClick={() => toggle(row.id)} className="text-[var(--text-mute)] hover:text-[var(--negative)]"><X size={11} /></button></div>)}</div>
        </div>
      )}

      {loading ? <div className="p-10 text-center font-mono text-xs text-[var(--text-dim)]">Cargando curvas y tasas…</div> : error ? <div className="p-8 text-center text-xs text-[var(--negative)]">{error}</div> : (
        <div className="overflow-auto rounded-md border border-[var(--border)]">
          <table className="w-full min-w-[650px] border-collapse font-mono text-[10px]">
            <thead className="sticky top-0 bg-[var(--bg-elev)] text-[var(--text-mute)]"><tr>{["", "Tasa / ticker", "Moneda", "Fuente", "Plazo", "Tipo", "Tasa"].map((label) => <th key={label} className="border-b border-[var(--border)] px-2 py-2 text-left font-normal first:text-center last:text-right">{label}</th>)}</tr></thead>
            <tbody>{matches.map((row) => {
              const active = selected.includes(row.id)
              return <tr key={row.id} className={cn("border-b border-[var(--border)] hover:bg-[var(--bg-elev-2)]", active && "bg-[var(--amber-soft)]/40")}><td className="px-2 py-2 text-center"><button onClick={() => toggle(row.id)} className={cn("inline-flex h-5 w-5 items-center justify-center rounded border", active ? "border-[var(--amber)] text-[var(--amber)]" : "border-[var(--border-hi)] text-[var(--text-mute)]")}>{active ? <Check size={11} /> : <Plus size={11} />}</button></td><td className="px-2 py-2"><div className="font-bold text-[var(--amber)]">{row.ticker}</div><div className="max-w-48 truncate font-sans text-[8px] text-[var(--text-mute)]">{row.name}</div></td><td className="px-2 py-2 text-[var(--text-dim)]">{row.currency}</td><td className="px-2 py-2 text-[var(--text-dim)]">{row.source}</td><td className="px-2 py-2 text-[var(--text-dim)]">{row.term}</td><td className="px-2 py-2 text-[var(--text-dim)]">{row.kind}</td><td className="px-2 py-2 text-right font-bold text-[var(--text)]">{pct(row.rate)}</td></tr>
            })}</tbody>
          </table>
          {matches.length === 0 && <div className="p-8 text-center text-xs text-[var(--text-dim)]">No hay tasas para ese filtro.</div>}
        </div>
      )}
      <div className="pt-2 font-mono text-[8px] text-[var(--text-mute)]">ARS: BCRA, letras y ROFEX · USD: Treasuries y bonos hard dollar · Configuración guardada localmente.</div>
    </div>
  )
}
