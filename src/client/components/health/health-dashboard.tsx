"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Activity, ArrowLeft, CircleAlert, Database, RefreshCw } from "lucide-react"
import {
  probeCardEndpoint,
  selectSafeHealthProbes,
  type CardHealthProbe,
  type CardHealthProbeResult,
} from "@/client/lib/card-health"
import { CARD_CATEGORIES, DATA_CARD_CATALOG } from "@/lib/card-catalog"

type SourceStatus = {
  name: string
  publisher: string
  source: string
  runtimeSource: string | null
  endpoint: string | null
  status: "success" | "error" | "unprobed"
  message: string
  transport: {
    status: "available" | "unavailable" | "not_configured"
    httpStatus: number | null
    checkedAt: string
    latencyMs: number
  }
  ingestion: { status: string; lastRun: string | null; recordsAdded?: number }
  freshness: {
    status: "fresh" | "stale" | "expired" | "unknown"
    asOf: string | null
    ageSeconds: number | null
    reason: string
  }
}

const MAX_CONCURRENCY = 6
const ADDITIONAL_DATA_PROBES: CardHealthProbe[] = [
  { label: "Histórico legacy ARS/USD", path: "/api/exchange-rates?limit=5", method: "GET" },
  { label: "Divisas internacionales ECB", path: "/api/fx-rates", method: "GET" },
]

function probeKey(probe: CardHealthProbe): string {
  return `${probe.method}:${probe.path}:${JSON.stringify(probe.body ?? null)}`
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "— no reportado"
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("es-AR") : value
}

function statusStyle(status: "ok" | "error" | "checking" | "unknown") {
  if (status === "ok") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
  if (status === "error") return "border-red-500/25 bg-red-500/10 text-red-400"
  if (status === "checking") return "border-amber-500/25 bg-amber-500/10 text-[var(--amber)]"
  return "border-[var(--border)] bg-[var(--bg-elev-2)] text-[var(--text-dim)]"
}

function StatusPill({ status, children }: { status: "ok" | "error" | "checking" | "unknown"; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] ${statusStyle(status)}`}>{children}</span>
}

export function HealthDashboard() {
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [probeResults, setProbeResults] = useState<Record<string, CardHealthProbeResult>>({})
  const [running, setRunning] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  const cardProbes = useMemo(() => DATA_CARD_CATALOG.map((card) => ({
    card,
    probes: selectSafeHealthProbes(card.endpoints),
  })), [])
  const uniqueProbes = useMemo(() => {
    const probes = new Map<string, CardHealthProbe>()
    for (const row of cardProbes) for (const probe of row.probes) probes.set(probeKey(probe), probe)
    for (const probe of ADDITIONAL_DATA_PROBES) probes.set(probeKey(probe), probe)
    return [...probes.values()]
  }, [cardProbes])

  const checkAll = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(true)
    setSources([])
    setProbeResults({})
    setSourceError(null)

    const sourceRequest = fetch("/api/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        setSources(await response.json() as SourceStatus[])
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSourceError(error instanceof Error ? error.message : "No se pudo consultar /api/status")
      })

    let cursor = 0
    const worker = async () => {
      while (!controller.signal.aborted && cursor < uniqueProbes.length) {
        const probe = uniqueProbes[cursor]
        cursor += 1
        try {
          const result = await probeCardEndpoint(probe, controller.signal)
          if (!controller.signal.aborted) setProbeResults((current) => ({ ...current, [probeKey(probe)]: result }))
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) throw error
        }
      }
    }

    await Promise.all([sourceRequest, ...Array.from({ length: Math.min(MAX_CONCURRENCY, uniqueProbes.length) }, worker)])
    if (!controller.signal.aborted) setRunning(false)
  }, [uniqueProbes])

  useEffect(() => {
    void checkAll()
    return () => controllerRef.current?.abort()
  }, [checkAll])

  const cardStates = cardProbes.map(({ card, probes }) => {
    const results = probes.map((probe) => probeResults[probeKey(probe)]).filter(Boolean)
    const checking = results.length < probes.length
    const status = checking ? "checking" as const : results.length > 0 && results.every((result) => result.ok) ? "ok" as const : "error" as const
    return { card, probes, status }
  })
  const cardsOk = cardStates.filter((row) => row.status === "ok").length
  const cardsError = cardStates.filter((row) => row.status === "error").length
  const sourcesOk = sources.filter((row) => row.status === "success").length
  const sourcesError = sources.filter((row) => row.status === "error").length
  const summaries = [
    { label: "Tarjetas OK", value: cardsOk, Icon: Activity, color: "text-emerald-400" },
    { label: "Tarjetas con error", value: cardsError, Icon: CircleAlert, color: "text-red-400" },
    { label: "Fuentes accesibles", value: sourcesOk, Icon: Database, color: "text-emerald-400" },
    { label: "Fuentes caídas", value: sourcesError, Icon: CircleAlert, color: "text-red-400" },
  ]

  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-6 text-[var(--text)] md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--text)]"><ArrowLeft size={13} /> Volver a La Pizarra</Link>
            <h1 className="text-2xl font-semibold tracking-tight">Health de datos</h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--text-dim)]">
              Verificación read-only en runtime. HTTP 200 no alcanza: cada tarjeta también exige datos, provenance y freshness verificables. Source y Timestamp salen de headers o del payload real; si el endpoint no los publica, se muestra explícitamente.
            </p>
          </div>
          <button type="button" onClick={() => void checkAll()} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2 text-xs hover:border-[var(--border-hi)] disabled:opacity-60">
            <RefreshCw size={14} className={running ? "animate-spin" : ""} /> {running ? "Verificando" : "Volver a verificar"}
          </button>
        </div>

        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaries.map(({ label, value, Icon, color }) => <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--text-mute)]"><Icon size={13} className={color} /> {label}</div>
            <div className="mt-2 font-mono text-2xl font-semibold">{value}</div>
          </div>)}
        </section>

        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-semibold">Fuentes de datos</h2><p className="text-[11px] text-[var(--text-mute)]">Registro completo; “sin sonda” no se interpreta como saludable.</p></div><span className="font-mono text-[10px] text-[var(--text-mute)]">{sources.length} fuentes</span></div>
          {sourceError ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">/api/status: {sourceError}</div> : <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
            <table><thead><tr><th>Fuente registrada</th><th>Runtime Source</th><th>Transporte</th><th>Frescura</th><th>Timestamp</th><th>Chequeado</th></tr></thead>
              <tbody>{sources.map((row) => <tr key={row.source}>
                <td><div className="font-medium text-[var(--text)]">{row.name}</div><div className="text-[9px] text-[var(--text-mute)]">{row.source} · {row.endpoint ?? "sin endpoint"}</div></td>
                <td className="text-[var(--text-dim)]">{row.runtimeSource ?? "— no reportada"}</td>
                <td><StatusPill status={row.status === "success" ? "ok" : row.status === "error" ? "error" : "unknown"}>{row.message}</StatusPill></td>
                <td><StatusPill status={row.freshness.status === "fresh" ? "ok" : row.freshness.status === "unknown" ? "unknown" : "error"}>{row.freshness.status}</StatusPill></td>
                <td className="text-[var(--text-dim)]">{formatTimestamp(row.freshness.asOf)}</td>
                <td className="text-[var(--text-dim)]">{formatTimestamp(row.transport.checkedAt)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </section>

        <section>
          <div className="mb-8">
            <div className="mb-3"><h2 className="text-lg font-semibold">Datasets adicionales</h2><p className="text-[11px] text-[var(--text-mute)]">Superficies de datos que no pertenecen hoy a una tarjeta visible, pero siguen siendo parte del runtime.</p></div>
            <div className="grid gap-3 lg:grid-cols-2">{ADDITIONAL_DATA_PROBES.map((probe) => {
              const result = probeResults[probeKey(probe)]
              return <article key={probeKey(probe)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{probe.label}</h3><StatusPill status={!result ? "checking" : result.ok ? "ok" : "error"}>{!result ? "verificando" : result.ok ? "datos disponibles" : "degradado"}</StatusPill></div>
                <div className="grid gap-1 text-[10px] text-[var(--text-dim)]"><span>Source: {result?.source ?? "— no reportada"}</span><span>Timestamp: {formatTimestamp(result?.timestamp)}</span><span className="font-mono text-[9px]">{probe.method} {probe.path}</span>{result?.error && <span className="text-red-400">{result.error}</span>}</div>
              </article>
            })}</div>
          </div>

          <div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-semibold">Tarjetas</h2><p className="text-[11px] text-[var(--text-mute)]">Todos los endpoints declarados en el catálogo visible.</p></div><span className="font-mono text-[10px] text-[var(--text-mute)]">{DATA_CARD_CATALOG.length} tarjetas · {uniqueProbes.length} probes únicos</span></div>
          <div className="space-y-7">{CARD_CATEGORIES.map((category) => <div key={category.id}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-mute)]">{category.label}</h3>
            <div className="grid gap-3 lg:grid-cols-2">{cardStates.filter((row) => row.card.category === category.id).map((row) => <article key={row.card.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-4">
              <div className="mb-3 flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">{row.card.title}</h4><p className="mt-0.5 text-[10px] text-[var(--text-mute)]">{row.card.id}</p></div><StatusPill status={row.status}>{row.status === "ok" ? "datos disponibles" : row.status === "error" ? "degradada" : "verificando"}</StatusPill></div>
              <div className="space-y-2">{row.probes.map((probe) => {
                const result = probeResults[probeKey(probe)]
                return <div key={probeKey(probe)} className="rounded-md border border-[var(--border-light)] bg-[var(--bg)] p-3 text-[10px]">
                  <div className="mb-2 flex items-center justify-between gap-2"><span className="font-medium text-[var(--text)]">{probe.label}</span><span className="font-mono text-[var(--text-mute)]">{result ? `${result.status ?? "timeout"} · ${result.latencyMs}ms` : "pendiente"}</span></div>
                  <div className="grid gap-1 text-[var(--text-dim)] sm:grid-cols-2"><span>Source: {result?.source ?? "— no reportada"}</span><span>Timestamp: {formatTimestamp(result?.timestamp)}</span></div>
                  <div className="mt-1 truncate font-mono text-[9px] text-[var(--text-mute)]">{probe.method} {probe.path}</div>
                  {result?.error && <div className="mt-1 text-red-400">{result.error}</div>}
                </div>
              })}</div>
            </article>)}</div>
          </div>)}</div>
        </section>
      </div>
    </main>
  )
}
