"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Globe2, Grid3X3, List, Landmark, Search, X } from "lucide-react"
import { deriveMarketCalendarEvents, type CountryCode, type MarketCalendarEvent, todayInBuenosAires } from "@/lib/calendar-events"
import { cn } from "@/lib/utils"

type EventKind = MarketCalendarEvent["kind"]

const KIND_META: Record<EventKind, { label: string; short: string; colorClass: string; dotClass: string }> = {
  bono: { label: "Pagos de bonos", short: "BONO", colorClass: "border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--amber)]", dotClass: "bg-[var(--amber)]" },
  fomc: { label: "FOMC (Fed)", short: "FOMC", colorClass: "border-[var(--sky)] bg-[var(--sky)]/10 text-[var(--sky)]", dotClass: "bg-[var(--sky)]" },
  indec: { label: "INDEC (IPC / EMAE)", short: "INDEC", colorClass: "border-[var(--positive)] bg-[var(--positive)]/10 text-[var(--positive)]", dotClass: "bg-[var(--positive)]" },
  intl_cpi: { label: "CPI EEUU / Japón", short: "CPI", colorClass: "border-[#A98EDA] bg-[#A98EDA]/10 text-[#A98EDA]", dotClass: "bg-[#A98EDA]" },
  banco_central: { label: "Bancos centrales (BCE / BOE / BOJ)", short: "BC", colorClass: "border-[var(--yellow)] bg-[var(--yellow)]/10 text-[var(--yellow)]", dotClass: "bg-[var(--yellow)]" },
}

const COUNTRY_META: Record<CountryCode, { label: string; flag: string }> = {
  AR: { label: "Argentina", flag: "🇦🇷" },
  US: { label: "EEUU", flag: "🇺🇸" },
  JP: { label: "Japón", flag: "🇯🇵" },
  EU: { label: "Eurozona", flag: "🇪🇺" },
  GB: { label: "Reino Unido", flag: "🇬🇧" },
}
const ALL_COUNTRIES = Object.keys(COUNTRY_META) as CountryCode[]
const COUNTRIES_KEY = "lapizarra.calendario.paises.v1"

/** Categorías con capacidad ya visible en la UI pero sin fuente oficial conectada todavía
 *  (sin fechas simuladas — mismo criterio de honestidad que el resto del proyecto). */
interface PendingSource { label: string; fuente: string; items: string[] }
const PENDING_SOURCES: PendingSource[] = [
  { label: "BCRA (REM / IPOM)", fuente: "BCRA — calendario de difusión oficial", items: ["BCRA · REM (relevamiento de expectativas)", "BCRA · IPOM (informe de política monetaria)"] },
  { label: "Licitaciones del Tesoro", fuente: "Secretaría de Finanzas / Tesoro", items: ["Colocación de deuda en pesos: instrumentos, montos y tasas adjudicadas"] },
  { label: "Earnings — empresas AR", fuente: "pendiente fuente oficial BYMA / CNV", items: ["GGAL", "YPF", "PAMP", "BMA", "LOMA", "TXAR", "CEPU"] },
]

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(utcDate(iso))
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
}

function daysUntil(iso: string, today: string): number {
  return Math.round((utcDate(iso).getTime() - utcDate(today).getTime()) / 86_400_000)
}

function RelativeDate({ iso, today }: { iso: string; today: string }) {
  const days = daysUntil(iso, today)
  const label = days === 0 ? "Hoy" : days === 1 ? "Mañana" : days < 30 ? `En ${days} días` : `En ${Math.round(days / 30)} meses`
  return <span className="font-mono text-[9px] font-semibold uppercase tracking-wide text-[var(--amber)]">{label}</span>
}

function EventCard({ event, today, onSelect }: { event: MarketCalendarEvent; today: string; onSelect: () => void }) {
  const meta = KIND_META[event.kind]
  return (
    <button type="button" onClick={onSelect} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-left transition hover:border-[var(--amber)]/60 hover:bg-[var(--bg-elev-2)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded border px-2 py-0.5 font-mono text-[10px] font-bold", meta.colorClass)}>{event.ticker}</span>
        <span className="text-xs font-semibold text-[var(--text)]">{event.title}</span>
        <span className="ml-auto"><RelativeDate iso={event.paymentDate} today={today} /></span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--text-dim)]">
        <span>{event.kind === "bono" ? "Pago" : "Fecha"} {shortDate(event.paymentDate)}</span>
        {event.kind === "bono" && <span>Renta {formatAmount(event.coupon)}</span>}
        {event.kind === "bono" && event.amortization > 0 && <span>Amort. {formatAmount(event.amortization)}</span>}
        {event.kind !== "bono" && <span>{event.detail}</span>}
      </div>
    </button>
  )
}

export function MarketCalendar() {
  const today = useMemo(() => todayInBuenosAires(), [])
  const allEvents = useMemo(() => deriveMarketCalendarEvents(today), [today])
  const initial = allEvents[0] ? utcDate(allEvents[0].paymentDate) : utcDate(today)
  const [month, setMonth] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() })
  const [view, setView] = useState<"month" | "agenda">("month")
  const [query, setQuery] = useState("")
  const [kinds, setKinds] = useState<Record<EventKind, boolean>>({ bono: true, fomc: true, indec: true, intl_cpi: true, banco_central: true })
  const [countries, setCountries] = useState<Record<CountryCode, boolean>>(() => Object.fromEntries(ALL_COUNTRIES.map((c) => [c, true])) as Record<CountryCode, boolean>)
  const [selected, setSelected] = useState<MarketCalendarEvent | null>(null)

  // Preferencia de países: se guarda en este dispositivo, igual que el resto del Canvas.
  useEffect(() => {
    const stored = localStorage.getItem(COUNTRIES_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Partial<Record<CountryCode, boolean>>
      setCountries((prev) => ({ ...prev, ...parsed }))
    } catch {
      // preferencia corrupta o de una version anterior -- se ignora, queda el default (todos)
    }
  }, [])
  useEffect(() => {
    localStorage.setItem(COUNTRIES_KEY, JSON.stringify(countries))
  }, [countries])

  const events = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es")
    return allEvents.filter((event) => {
      if (!kinds[event.kind]) return false
      if (!countries[event.country]) return false
      if (!normalized) return true
      const haystack = event.kind === "bono" ? `${event.ticker} ${event.title} ${event.currency} ${event.law}` : `${event.ticker} ${event.title} ${event.detail}`
      return haystack.toLocaleLowerCase("es").includes(normalized)
    })
  }, [allEvents, query, kinds, countries])

  const eventsByDay = useMemo(() => {
    const result = new Map<string, MarketCalendarEvent[]>()
    for (const event of events) result.set(event.paymentDate, [...(result.get(event.paymentDate) ?? []), event])
    return result
  }, [events])

  const monthCells = useMemo(() => {
    const firstWeekday = (new Date(Date.UTC(month.year, month.month, 1)).getUTCDay() + 6) % 7
    const daysInMonth = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate()
    const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
    return Array.from({ length: cells }, (_, index) => {
      const day = index - firstWeekday + 1
      const date = new Date(Date.UTC(month.year, month.month, day))
      return {
        iso: isoDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === month.month,
        weekday: index % 7,
      }
    })
  }, [month])

  function moveMonth(delta: number) {
    const next = new Date(Date.UTC(month.year, month.month + delta, 1))
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() })
  }

  return (
    <div className="min-h-[calc(100vh-49px)] bg-[var(--bg)] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--amber-soft)] text-[var(--amber)]"><CalendarDays size={20} /></div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text)]">Calendario de mercado</h1>
            <p className="text-xs text-[var(--text-dim)]">Bonos, bancos centrales e inflación — Argentina, EEUU, Japón, Eurozona y Reino Unido.</p>
          </div>
          <div className="ml-auto flex rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-1">
            <button type="button" onClick={() => setView("month")} className={cn("flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px]", view === "month" ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "text-[var(--text-dim)]")}><Grid3X3 size={12} />Mes</button>
            <button type="button" onClick={() => setView("agenda")} className={cn("flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px]", view === "agenda" ? "bg-[var(--amber-soft)] text-[var(--amber)]" : "text-[var(--text-dim)]")}><List size={12} />Agenda</button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-[var(--text-mute)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ticker o instrumento…" className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-xs text-[var(--text)] outline-none focus:border-[var(--amber)]" />
            </div>
            <div className="font-mono text-[10px] text-[var(--text-dim)]">{events.length} eventos · corte {today}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Globe2 size={12} className="shrink-0 text-[var(--text-dim)]" />
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">País</span>
            <div className="flex flex-wrap gap-2">
              {ALL_COUNTRIES.map((code) => {
                const meta = COUNTRY_META[code]
                const on = countries[code]
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setCountries((prev) => ({ ...prev, [code]: !prev[code] }))}
                    className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition", on ? "border-[var(--amber)]/50 bg-[var(--amber-soft)] text-[var(--text)]" : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-mute)]")}
                  >
                    <span>{meta.flag}</span>
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(KIND_META) as EventKind[]).map((kind) => {
              const meta = KIND_META[kind]
              const on = kinds[kind]
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setKinds((prev) => ({ ...prev, [kind]: !prev[kind] }))}
                  className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition", on ? meta.colorClass : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-mute)]")}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", on ? meta.dotClass : "bg-[var(--text-mute)]")} />
                  {meta.label}
                </button>
              )
            })}
            {PENDING_SOURCES.map((source) => (
              <span key={source.label} title={`${source.fuente} — sin conectar`} className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border-hi)] bg-[var(--bg)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-mute)]">
                {source.label} <span className="rounded border border-[var(--border-hi)] px-1 text-[8px]">NC</span>
              </span>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[10px] leading-4 text-[var(--text-mute)]">
            Cobertura actual: bonos AR (motor verificado), FOMC, bancos centrales de la Eurozona/Reino Unido/Japón, e inflación de Argentina/EEUU/Japón. La fecha de bonos es la fecha efectiva, corrida al siguiente día hábil; no se inventan eventos macro, licitaciones ni earnings — ver &quot;fuentes pendientes&quot; abajo. La preferencia de países se guarda en este dispositivo.
          </div>
        </div>

        {view === "month" ? (
          <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <button type="button" onClick={() => moveMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--amber)] hover:text-[var(--amber)]"><ChevronLeft size={15} /></button>
              <div className="min-w-44 text-center text-sm font-semibold text-[var(--text)]">{MONTHS[month.month]} {month.year}</div>
              <button type="button" onClick={() => moveMonth(1)} className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--amber)] hover:text-[var(--amber)]"><ChevronRight size={15} /></button>
              <button type="button" onClick={() => setMonth({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() })} className="ml-2 rounded border border-[var(--border)] px-2.5 py-1.5 text-[9px] uppercase tracking-wide text-[var(--text-dim)] hover:text-[var(--amber)]">Próximo pago</button>
            </div>
            <div className="overflow-x-auto p-3">
              <div className="min-w-[840px]">
                <div className="mb-1 grid grid-cols-7 gap-1">{WEEKDAYS.map((day) => <div key={day} className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-mute)]">{day}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">
                  {monthCells.map((cell) => {
                    const dayEvents = eventsByDay.get(cell.iso) ?? []
                    const isToday = cell.iso === today
                    return (
                      <div key={cell.iso} className={cn("min-h-28 rounded-md border p-2", cell.inMonth ? "border-[var(--border)] bg-[var(--bg)]" : "border-transparent bg-transparent opacity-40", isToday && "border-[var(--amber)] bg-[var(--amber-soft)]/30")}>
                        <div className={cn("mb-2 font-mono text-[10px]", isToday ? "font-bold text-[var(--amber)]" : "text-[var(--text-dim)]")}>{cell.day}</div>
                        <div className="space-y-1">
                          {dayEvents.map((event) => {
                            const meta = KIND_META[event.kind]
                            const sub = event.kind === "bono" ? (event.amortization > 0 ? "R+A" : "Renta") : meta.short
                            return (
                              <button key={event.id} type="button" onClick={() => setSelected(event)} className={cn("block w-full truncate rounded border-l-2 px-1.5 py-1 text-left font-mono text-[9px] font-semibold text-[var(--text)] hover:bg-[var(--bg-elev-2)]", meta.colorClass)}>
                                {event.ticker} · {sub}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            {events.length === 0 ? <div className="p-10 text-center text-xs text-[var(--text-dim)]">No hay eventos para esta búsqueda.</div> : events.map((event) => <EventCard key={event.id} event={event} today={today} onSelect={() => setSelected(event)} />)}
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <Landmark size={14} className="text-[var(--text-dim)]" />
            <span className="text-xs font-semibold text-[var(--text)]">Próximamente — fuentes pendientes de conectar</span>
            <span className="text-[10px] text-[var(--text-mute)]">capacidad ya visible en la UI; se activa al enchufar la fuente oficial, sin fechas simuladas</span>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            {PENDING_SOURCES.map((source) => (
              <div key={source.label} className="rounded-md border border-dashed border-[var(--border-hi)] bg-[var(--bg)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text)]">{source.label}</span>
                  <span className="rounded-full border border-[var(--border-hi)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[var(--text-mute)]">no conectada</span>
                </div>
                <p className="mb-2 text-[10px] text-[var(--text-mute)]">{source.fuente}</p>
                <div className="flex flex-wrap gap-1">
                  {source.items.map((item) => <span key={item} className="rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-dim)]">{item}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {selected && (
        <>
          <button type="button" aria-label="Cerrar detalle" onClick={() => setSelected(null)} className="fixed inset-0 z-[90] bg-black/50" />
          <aside className="fixed inset-y-0 right-0 z-[91] w-full max-w-md overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl">
            <div className="flex items-start gap-3 border-b border-[var(--border)] p-5">
              <div className={cn("rounded border px-2 py-1 font-mono text-sm font-bold", KIND_META[selected.kind].colorClass)}>{selected.ticker}</div>
              <div><h2 className="text-base font-semibold text-[var(--text)]">{selected.title}</h2><p className="mt-1 text-[10px] text-[var(--text-dim)]">{selected.kind === "bono" ? "Pago efectivo" : "Fecha"} {shortDate(selected.paymentDate)}</p></div>
              <button type="button" onClick={() => setSelected(null)} className="ml-auto text-[var(--text-mute)] hover:text-[var(--text)]"><X size={17} /></button>
            </div>
            <div className="space-y-4 p-5 text-xs">
              {selected.kind === "bono" ? (
                <dl className="grid grid-cols-[140px_1fr] gap-y-3">
                  <dt className="text-[var(--text-mute)]">Fecha prospecto</dt><dd className="font-mono text-[var(--text)]">{selected.accrualDate}</dd>
                  <dt className="text-[var(--text-mute)]">Fecha efectiva</dt><dd className="font-mono text-[var(--text)]">{selected.paymentDate}</dd>
                  <dt className="text-[var(--text-mute)]">Renta / VN 100</dt><dd className="font-mono text-[var(--text)]">{formatAmount(selected.coupon)} {selected.currency}</dd>
                  <dt className="text-[var(--text-mute)]">Amortización / VN 100</dt><dd className="font-mono text-[var(--text)]">{formatAmount(selected.amortization)}</dd>
                  <dt className="text-[var(--text-mute)]">Residual previo</dt><dd className="font-mono text-[var(--text)]">{formatAmount(selected.residualBeforePayment)}</dd>
                  <dt className="text-[var(--text-mute)]">Ley</dt><dd className="text-[var(--text)]">{selected.law === "NY" ? "Nueva York" : "Argentina"}</dd>
                </dl>
              ) : (
                <dl className="grid grid-cols-[140px_1fr] gap-y-3">
                  <dt className="text-[var(--text-mute)]">Fecha</dt><dd className="font-mono text-[var(--text)]">{selected.paymentDate}</dd>
                  <dt className="text-[var(--text-mute)]">Detalle</dt><dd className="text-[var(--text)]">{selected.detail}</dd>
                </dl>
              )}
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 text-[10px] leading-4 text-[var(--text-dim)]"><b className="text-[var(--text)]">Fuente:</b> {selected.source}</div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
