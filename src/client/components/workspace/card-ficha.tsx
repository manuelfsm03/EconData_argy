"use client"

/**
 * CardFicha — panel lateral con la "profundidad" de una tarjeta.
 *
 * Muestra 4 cosas: (1) la serie larga del dato, (2) la fuente con atribución y
 * frescura, (3) cómo se calcula, (4) qué otras tarjetas usan el mismo dato o
 * están relacionadas (navegables: abren su propia ficha, con botón "volver").
 *
 * Accesibilidad: role="dialog" + aria-modal, foco atrapado dentro del panel,
 * Escape cierra, el foco vuelve al elemento que la abrió, y un aria-live avisa
 * cuando se navega a otra ficha. Se pinta en un portal a <body> (no dentro de la
 * grilla del Canvas, cuyos items tienen transform y romperían el `fixed`).
 *
 * Toda la lógica no visual vive en `src/lib/card-ficha.ts` (testeada).
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ChevronRight, X } from "lucide-react"
import { BBGLineChart } from "@/client/components/charts/bbg-line-chart"
import { cn } from "@/lib/utils"
import {
  buildFichaView,
  evaluateFreshness,
  extractSeries,
  nextFocusIndex,
  type FichaFreshness,
  type FichaSeries,
} from "@/lib/card-ficha"
import { slugTermino } from "@/lib/glossary"
import type { DataCardDefinition } from "@/lib/card-catalog"

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea'

type SerieState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "error"; freshness: FichaFreshness }
  | { status: "ok"; series: FichaSeries; freshness: FichaFreshness }

const FRESHNESS_TONE: Record<FichaFreshness["state"], string> = {
  al_dia: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  con_demora: "border-[var(--amber)]/30 bg-[var(--amber-soft)] text-[var(--amber)]",
  vencido: "border-red-500/25 bg-red-500/10 text-red-400",
  caida: "border-red-500/25 bg-red-500/10 text-red-400",
  respaldo: "border-[var(--amber)]/30 bg-[var(--amber-soft)] text-[var(--amber)]",
  sin_dato: "border-[var(--border)] bg-[var(--bg-elev-2)] text-[var(--text-dim)]",
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-mute)]">{children}</h3>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-[11px] leading-5 text-[var(--text-dim)]">{children}</p>
}

function RelatedButton({ card, onOpen }: { card: DataCardDefinition; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(card.id)}
      className="group flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-left transition-colors hover:border-[var(--amber)] hover:bg-[var(--bg-elev-2)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-[var(--text)]">{card.title}</span>
        <span className="mt-0.5 line-clamp-1 block text-[10px] text-[var(--text-dim)]">{card.description}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-[var(--text-mute)] group-hover:text-[var(--amber)]" aria-hidden="true" />
    </button>
  )
}

interface CardFichaProps {
  /** Id de la tarjeta a abrir; `null` = cerrada. */
  cardId: string | null
  onClose: () => void
}

export function CardFicha({ cardId, onClose }: CardFichaProps) {
  const [stack, setStack] = useState<string[]>([])
  const [serie, setSerie] = useState<SerieState>({ status: "none" })
  const panelRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Al abrir (null -> id) se reinicia el recorrido; si cambia el id desde afuera, también.
  useEffect(() => {
    if (cardId) {
      openerRef.current = (document.activeElement as HTMLElement | null) ?? null
      setStack([cardId])
    } else {
      setStack([])
    }
  }, [cardId])

  const currentId = stack.at(-1) ?? null
  const view = useMemo(() => (currentId ? buildFichaView(currentId) : null), [currentId])

  // Foco: al abrir y al navegar va al título; al cerrar vuelve a quien abrió.
  useEffect(() => {
    if (currentId) titleRef.current?.focus()
  }, [currentId])
  useEffect(() => {
    if (cardId) return
    const opener = openerRef.current
    openerRef.current = null
    opener?.focus?.()
  }, [cardId])

  // Serie larga del endpoint existente de la tarjeta.
  useEffect(() => {
    const spec = view?.card.serieEndpoint
    if (!view || !spec) {
      setSerie({ status: "none" })
      return
    }
    const controller = new AbortController()
    setSerie({ status: "loading" })
    ;(async () => {
      try {
        const response = await fetch(spec.path, {
          method: spec.method ?? "GET",
          headers: spec.body ? { "Content-Type": "application/json" } : undefined,
          body: spec.body ? JSON.stringify(spec.body) : undefined,
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload: unknown = await response.json()
        const series = extractSeries(payload, spec)
        if (series.rows.length === 0) throw new Error("serie vacía")
        const stale = (payload as { stale?: unknown } | null)?.stale === true || response.headers.get("x-data-freshness") === "stale"
        setSerie({
          status: "ok",
          series,
          freshness: evaluateFreshness({ lastDate: series.lastDate, claseDato: spec.claseDato, sourceId: view.card.fuenteId, stalePayload: stale }),
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setSerie({ status: "error", freshness: evaluateFreshness({ lastDate: null, fetchFailed: true }) })
      }
    })()
    return () => controller.abort()
  }, [view])

  const openRelated = useCallback((id: string) => setStack((current) => (current.at(-1) === id ? current : [...current, id])), [])
  const goBack = useCallback(() => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)), [])

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== "Tab" || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => !item.hasAttribute("disabled") && item.offsetParent !== null)
    const target = nextFocusIndex(items.length, items.indexOf(document.activeElement as HTMLElement), event.shiftKey)
    if (target !== null) {
      event.preventDefault()
      items[target].focus()
    } else if (items.length === 0) {
      event.preventDefault()
    }
  }, [onClose])

  if (!mounted || !cardId || !view) return null
  const { card, source, glossary, comparten, relacionadas } = view
  const freshness = serie.status === "ok" || serie.status === "error" ? serie.freshness : null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[190] bg-black/55" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="fixed right-0 top-0 z-[200] flex h-full w-[min(34rem,100vw)] flex-col border-l border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text)] shadow-2xl"
      >
        <header className="flex items-start gap-2 border-b border-[var(--border)] px-4 py-3">
          {stack.length > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--amber)]"
              aria-label={`Volver a ${tituloDe(stack.at(-2))}`}
              title="Volver"
            >
              <ArrowLeft size={15} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--text-mute)]">Ficha · {card.category}</p>
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-base font-semibold leading-tight text-[var(--text)] outline-none">{card.title}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-dim)]">{card.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
            aria-label="Cerrar ficha"
            title="Cerrar (Esc)"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <p className="sr-only" role="status" aria-live="polite">{`Ficha de ${card.title}`}</p>

          {/* 1. Serie larga */}
          <section aria-label="Serie histórica">
            <SectionTitle>1 · Serie histórica</SectionTitle>
            {serie.status === "none" && <Empty>Esta tarjeta todavía no declara un endpoint con serie larga. Cuando se declare, el histórico aparece acá.</Empty>}
            {serie.status === "loading" && <div className="flex h-[220px] items-center justify-center rounded-md border border-[var(--border)] font-mono text-[10px] text-[var(--text-mute)]" role="status">CARGANDO SERIE...</div>}
            {serie.status === "error" && <Empty>No se pudo traer la serie en esta consulta. El detalle del estado está en la sección de fuente.</Empty>}
            {serie.status === "ok" && card.serieEndpoint && (
              <>
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg)]">
                  <BBGLineChart
                    data={serie.series.rows}
                    lines={serie.series.lines.map((line) => ({ key: line.key, name: line.name, color: line.color }))}
                    title={card.serieEndpoint.unit ? `${card.title} · ${card.serieEndpoint.unit}` : card.title}
                    height={220}
                    defaultRange="all"
                    enableLineToggle={serie.series.lines.length > 1}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] leading-4 text-[var(--text-mute)]">
                  {serie.series.points} puntos{card.serieEndpoint.ventana ? ` · ${card.serieEndpoint.ventana}` : ""}
                </p>
              </>
            )}
          </section>

          {/* 2. Fuente y frescura */}
          <section aria-label="Fuente y frescura">
            <SectionTitle>2 · Fuente y frescura</SectionTitle>
            {source ? (
              <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-[11px]">
                <dt className="text-[var(--text-mute)]">Publica</dt>
                <dd className="text-[var(--text)]">{source.publisher}</dd>
                <dt className="text-[var(--text-mute)]">Fuente</dt>
                <dd className="text-[var(--text)]">{source.displayName} <span className="font-mono text-[10px] text-[var(--text-mute)]">({source.host})</span></dd>
                {source.fallbackNames.length > 0 && (
                  <>
                    <dt className="text-[var(--text-mute)]">Respaldo</dt>
                    <dd className="text-[var(--text)]">{source.fallbackNames.join(", ")}</dd>
                  </>
                )}
              </dl>
            ) : (
              <Empty>Esta tarjeta todavía no tiene una fuente declarada en el registro. No se atribuye ninguna hasta verificarla.</Empty>
            )}
            {freshness && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase", FRESHNESS_TONE[freshness.state])}>{freshness.label}</span>
                <span className="text-[11px] text-[var(--text-dim)]">{freshness.detail}</span>
              </div>
            )}
            <ul className="mt-3 space-y-0.5">
              {card.endpoints.map((endpoint) => (
                <li key={`${endpoint.method ?? "GET"}${endpoint.path}`} className="font-mono text-[10px] text-[var(--text-mute)]">
                  {endpoint.method ?? "GET"} {endpoint.path} <span className="text-[var(--text-dim)]">· {endpoint.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 3. Cómo se calcula */}
          <section aria-label="Cómo se calcula">
            <SectionTitle>3 · Cómo se calcula</SectionTitle>
            {card.calculo ? <p className="text-xs leading-6 text-[var(--text)]">{card.calculo}</p> : <Empty>Todavía no hay una descripción verificada de cómo se calcula este dato.</Empty>}
            {glossary.length > 0 && (
              <ul className="mt-3 space-y-2">
                {glossary.map(({ id, entry }) => (
                  <li key={id} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--amber)]">
                      {entry.nombre ?? id}{entry.sigla && entry.sigla !== entry.nombre ? ` · ${entry.sigla}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--text-dim)]">{entry.text}</p>
                    <a href={`/glosario#${slugTermino(id)}`} className="mt-1 inline-block text-[10px] text-[var(--amber)] underline-offset-2 hover:underline">Aprender más</a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4. Relacionadas */}
          <section aria-label="Tarjetas relacionadas">
            <SectionTitle>4 · Para seguir recorriendo</SectionTitle>
            {comparten.length === 0 && relacionadas.length === 0 && <Empty>Todavía no hay otras tarjetas vinculadas a esta.</Empty>}
            {comparten.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[10px] text-[var(--text-mute)]">Usan el mismo dato</p>
                <div className="space-y-1.5">{comparten.map((item) => <RelatedButton key={item.id} card={item} onOpen={openRelated} />)}</div>
              </div>
            )}
            {relacionadas.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] text-[var(--text-mute)]">Relacionadas</p>
                <div className="space-y-1.5">{relacionadas.map((item) => <RelatedButton key={item.id} card={item} onOpen={openRelated} />)}</div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>,
    document.body,
  )
}

function tituloDe(id: string | undefined): string {
  return (id && buildFichaView(id)?.card.title) || "la ficha anterior"
}
