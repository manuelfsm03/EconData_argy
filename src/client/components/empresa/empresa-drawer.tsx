"use client"

import { useEffect, useState, useCallback } from "react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { X, ExternalLink, TrendingUp, TrendingDown, Users, Globe, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TickerKind } from "@/lib/ticker-nav"

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface HistPoint { date: string; close: number | null }

interface EmpresaData {
  ticker: string
  shortName: string
  longName: string | null
  sector: string | null
  industry: string | null
  employees: number | null
  website: string | null
  description: string | null
  country: string
  city: string | null
  adrUsed?: boolean
  fundamentalsSymbol?: string
  lastPrice: number | null
  previousClose: number | null
  high52w: number | null
  low52w: number | null
  currency: string
  // Valuación
  marketCap: number | null
  enterpriseValue: number | null
  peRatioTtm: number | null
  peForward: number | null
  eps: number | null
  beta: number | null
  priceToBook: number | null
  evToEbitda: number | null
  evToRevenue: number | null
  dividendYield: number | null
  // P&L TTM
  ebitda: number | null
  ebit: number | null
  totalRevenue: number | null
  grossProfit: number | null
  netIncome: number | null
  operatingCashflow: number | null
  freeCashflow: number | null
  totalDebt: number | null
  // Márgenes
  ebitdaMargin: number | null
  grossMargin: number | null
  operatingMargin: number | null
  profitMargin: number | null
  revenueGrowth: number | null
  earningsGrowth: number | null
  returnOnEquity: number | null
  returnOnAssets: number | null
  history: HistPoint[]
  // ── Metadatos de moneda / período / fuente (auditoría — feedback revisor) ──
  fundamentalsSource?: string
  fundamentalsPeriodo?: string | null
  fundamentalsCurrency?: string | null
  monedas?: { precio: string; fundamentals: string; marketCap: string }
  // { campo: { moneda, periodo, fuente } } — moneda=null → métrica adimensional
  metricasMeta?: Record<string, { moneda: string | null; periodo: string; fuente: string }>
  fuente_efectiva?: string
  fecha_actualizacion?: string
  ratios_moneda_mismatch?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Period = "1m" | "3m" | "6m" | "1y" | "max"
const PERIODS: { key: Period; label: string }[] = [
  { key: "1m",  label: "1M"  },
  { key: "3m",  label: "3M"  },
  { key: "6m",  label: "6M"  },
  { key: "1y",  label: "1A"  },
  { key: "max", label: "Máx" },
]

function fmt(n: number | null, opts?: Intl.NumberFormatOptions): string {
  if (n == null) return "—"
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2, ...opts })
}

function fmtBig(n: number | null): string {
  if (n == null) return "—"
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number | null): string {
  if (n == null) return "—"
  return `${(n * 100).toFixed(1)}%`
}

function dateLabel(iso: string): string {
  return iso.slice(5) // MM-DD
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function MetricCard({
  label, value, highlight, moneda, periodo, warn, title,
}: {
  label: string
  value: string
  highlight?: boolean
  moneda?: string | null   // "USD" / "ARS" — se muestra chico junto al período
  periodo?: string         // "TTM" / "FY2025" / "actual" — contexto del dato
  warn?: boolean           // resalta en ámbar si el dato no es comparable
  title?: string           // tooltip: fuente efectiva o advertencia
}) {
  // Línea de contexto: moneda + período (sólo lo que esté disponible)
  const contexto = [moneda, periodo].filter(Boolean).join(" · ")
  return (
    <div
      title={title}
      className={cn(
        "rounded-md border px-3 py-2",
        warn
          ? "border-[var(--amber)]/50 bg-[var(--amber-soft)]"
          : "border-[var(--border)] bg-[var(--bg)]",
      )}
    >
      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-mute)]">{label}</div>
      <div className={cn("font-mono text-sm font-semibold", highlight ? "text-[var(--amber)]" : "text-[var(--text)]")}>
        {value}
      </div>
      {contexto && (
        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-wide text-[var(--text-mute)]">
          {contexto}
        </div>
      )}
    </div>
  )
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function PriceChart({ history, currency }: { history: HistPoint[]; currency: string }) {
  const valid = history.filter((h) => h.close != null)
  if (valid.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center font-mono text-xs text-[var(--text-mute)]">
        Sin datos históricos
      </div>
    )
  }

  const prices = valid.map((h) => h.close as number)
  const first = prices[0]
  const last  = prices[prices.length - 1]
  const isUp  = last >= first
  const strokeColor = isUp ? "var(--positive)" : "var(--negative)"

  const gradId = `empresa-grad-${isUp ? "up" : "dn"}`

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={valid} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dateLabel}
          tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 8, fill: "var(--text-mute)", fontFamily: "monospace" }}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 10,
            fontFamily: "monospace",
            color: "var(--text)",
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(l: any) => l as string}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any) => [`${currency} ${fmt(v as number)}`, "Precio"] as any}
        />
        <Area
          type="monotone"
          dataKey="close"
          stroke={strokeColor}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, fill: strokeColor, stroke: "var(--bg)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Vista principal de la empresa ───────────────────────────────────────────

function EmpresaContent({ ticker, kind }: { ticker: string; kind: TickerKind }) {
  const [data, setData]     = useState<EmpresaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>("1y")
  const [descExpanded, setDescExpanded] = useState(false)

  const load = useCallback((p: Period) => {
    setLoading(true)
    setError(null)

    if (kind === "accion" || kind === "accion_usa") {
      const market = kind === "accion_usa" ? "usa" : "arg"
      fetch(`/api/empresa/${ticker}?range=${p}&market=${market}`)
        .then((r) => r.json())
        .then((j) => { setData(j.data); setLoading(false) })
        .catch(() => { setError("Error al cargar datos"); setLoading(false) })
    } else {
      // Para bonos: histórico desde la API de bonos
      fetch(`/api/bonos/${ticker}/historico?dias=${p === "max" ? 720 : p === "1y" ? 365 : p === "6m" ? 180 : p === "3m" ? 90 : 30}`)
        .then((r) => r.json())
        .then((j) => {
          const hist = (j.history ?? []).map((h: { date: string; priceUsd: number }) => ({
            date: h.date, close: h.priceUsd,
          }))
          setData({
            ticker,
            shortName: ticker,
            longName: null,
            sector: "Renta Fija",
            industry: "Soberano Argentina",
            employees: null,
            website: null,
            description: null,
            country: "Argentina",
            city: null,
            lastPrice: hist.at(-1)?.close ?? null,
            previousClose: hist.at(-2)?.close ?? null,
            high52w: null,
            low52w: null,
            currency: "USD",
            marketCap: null, enterpriseValue: null, peRatioTtm: null, peForward: null,
            eps: null, beta: null, priceToBook: null, evToEbitda: null, evToRevenue: null,
            dividendYield: null,
            ebitda: null, ebit: null, totalRevenue: null, grossProfit: null, netIncome: null,
            operatingCashflow: null, freeCashflow: null, totalDebt: null,
            ebitdaMargin: null, grossMargin: null, operatingMargin: null, profitMargin: null,
            revenueGrowth: null, earningsGrowth: null, returnOnEquity: null, returnOnAssets: null,
            history: hist,
          })
          setLoading(false)
        })
        .catch(() => { setError("Error al cargar histórico del bono"); setLoading(false) })
    }
  }, [ticker, kind])

  useEffect(() => { load(period) }, [load, period])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--amber)] border-t-transparent" />
          <span className="font-mono text-[10px] text-[var(--text-mute)]">Cargando {ticker}…</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center font-mono text-xs text-[var(--negative)]">
        {error ?? "Sin datos disponibles"}
      </div>
    )
  }

  const change1D = data.lastPrice != null && data.previousClose != null && data.previousClose > 0
    ? ((data.lastPrice - data.previousClose) / data.previousClose) * 100
    : null
  const isUp = change1D != null ? change1D >= 0 : null

  // 52-week range bar
  const range52 = data.high52w != null && data.low52w != null && data.lastPrice != null
    ? Math.min(100, Math.max(0, ((data.lastPrice - data.low52w) / (data.high52w - data.low52w)) * 100))
    : null

  // Metadatos por métrica (moneda/período/fuente) para el etiquetado auditable
  const mMeta = data.metricasMeta ?? {}
  // Devuelve las props {moneda, periodo, title} de una métrica para MetricCard
  const metaProps = (campo: string) => {
    const m = mMeta[campo]
    if (!m) return {}
    return { moneda: m.moneda ?? undefined, periodo: m.periodo, title: `Fuente: ${m.fuente}` }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Precio + variación */}
      <div className="flex items-end gap-3">
        <div>
          <div className="font-mono text-2xl font-bold text-[var(--text)]">
            {data.currency} {fmt(data.lastPrice)}
          </div>
          <div className="font-mono text-[10px] text-[var(--text-mute)]">
            Cierre anterior: {fmt(data.previousClose)}
          </div>
        </div>
        {change1D != null && (
          <div className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-semibold",
            isUp
              ? "bg-[var(--positive)]/10 text-[var(--positive)]"
              : "bg-[var(--negative)]/10 text-[var(--negative)]",
          )}>
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isUp ? "+" : ""}{fmt(change1D)}%
          </div>
        )}
      </div>

      {/* Rango 52 semanas */}
      {range52 != null && (
        <div>
          <div className="mb-1 flex justify-between font-mono text-[9px] text-[var(--text-mute)]">
            <span>Min 52s: {fmt(data.low52w)}</span>
            <span>Máx 52s: {fmt(data.high52w)}</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[var(--amber)]"
              style={{ width: `${range52}%` }}
            />
          </div>
        </div>
      )}

      {/* Selector de período + gráfico */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 pb-3 pt-2">
        <div className="mb-3 flex gap-1">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                "h-6 rounded px-2.5 font-mono text-[9px] font-semibold uppercase tracking-wider transition-colors",
                period === key
                  ? "bg-[var(--amber)] text-[var(--bg)]"
                  : "text-[var(--text-mute)] hover:text-[var(--text)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <PriceChart history={data.history} currency={data.currency} />
      </div>

      {/* Nota de moneda / fuente (ADR o cotización local) — consistente con el
          etiquetado por-métrica de las cards de abajo */}
      {(kind === "accion" || kind === "accion_usa") && data.monedas && (
        <div className="rounded-md border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3 py-1.5 font-mono text-[9px] leading-relaxed text-[var(--amber)]">
          {data.adrUsed ? (
            <>
              Fundamentals vía ADR <span className="font-bold">{data.fundamentalsSymbol}</span>{" "}
              ({data.monedas.fundamentals}{mMeta.ebitda?.periodo ? ` · ${mMeta.ebitda.periodo}` : ""}) ·{" "}
              precio del gráfico en {data.monedas.precio} · market cap en {data.monedas.marketCap}
            </>
          ) : (
            <>Precio y fundamentals en {data.monedas.fundamentals}{mMeta.ebitda?.periodo ? ` · ${mMeta.ebitda.periodo}` : ""}</>
          )}
        </div>
      )}

      {/* Guardrail ARS/USD: aviso de ratios no comparables por mezcla de monedas */}
      {data.ratios_moneda_mismatch && (
        <div className="rounded-md border border-[var(--negative)]/40 bg-[var(--negative)]/10 px-3 py-1.5 font-mono text-[9px] leading-relaxed text-[var(--negative)]">
          EV/EBITDA y EV/Revenue no se muestran: el market cap está en{" "}
          <span className="font-bold">{data.monedas?.marketCap}</span> y los estados en{" "}
          <span className="font-bold">{data.monedas?.fundamentals}</span> — el ratio no es
          comparable sin conversión de moneda.
        </div>
      )}

      {/* Valuación */}
      {(kind === "accion" || kind === "accion_usa") && (
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[var(--text-mute)]">Valuación</div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Market Cap"    value={fmtBig(data.marketCap)}      {...metaProps("marketCap")} />
            <MetricCard label="Enterprise V." value={fmtBig(data.enterpriseValue)} {...metaProps("enterpriseValue")} />
            <MetricCard label="P/E TTM"       value={fmt(data.peRatioTtm)}        {...metaProps("peRatioTtm")} />
            <MetricCard label="P/E Forward"   value={fmt(data.peForward)}         {...metaProps("peForward")} />
            {/* EV/EBITDA y EV/Revenue: si hay mismatch de monedas, no son comparables */}
            <MetricCard
              label="EV/EBITDA"
              value={data.ratios_moneda_mismatch ? "n/c" : fmt(data.evToEbitda)}
              moneda={mMeta.evToEbitda?.moneda ?? undefined}
              periodo={mMeta.evToEbitda?.periodo}
              warn={data.ratios_moneda_mismatch}
              title={data.ratios_moneda_mismatch
                ? `No comparable — EV en ${data.monedas?.marketCap ?? "?"} y EBITDA en ${data.monedas?.fundamentals ?? "?"}`
                : (mMeta.evToEbitda ? `Fuente: ${mMeta.evToEbitda.fuente}` : undefined)}
            />
            <MetricCard
              label="EV/Revenue"
              value={data.ratios_moneda_mismatch ? "n/c" : fmt(data.evToRevenue)}
              moneda={mMeta.evToRevenue?.moneda ?? undefined}
              periodo={mMeta.evToRevenue?.periodo}
              warn={data.ratios_moneda_mismatch}
              title={data.ratios_moneda_mismatch
                ? `No comparable — EV en ${data.monedas?.marketCap ?? "?"} y Revenue en ${data.monedas?.fundamentals ?? "?"}`
                : (mMeta.evToRevenue ? `Fuente: ${mMeta.evToRevenue.fuente}` : undefined)}
            />
            <MetricCard label="P/Book"        value={fmt(data.priceToBook)}       {...metaProps("priceToBook")} />
            <MetricCard label="EPS"           value={data.eps != null ? fmt(data.eps) : "—"} {...metaProps("eps")} />
            <MetricCard label="Beta"          value={fmt(data.beta)}              {...metaProps("beta")} />
            <MetricCard label="Div. Yield"    value={data.dividendYield != null ? fmtPct(data.dividendYield) : "—"} {...metaProps("dividendYield")} />
          </div>
        </div>
      )}

      {/* P&L TTM */}
      {(kind === "accion" || kind === "accion_usa") && (data.ebitda != null || data.totalRevenue != null || data.ebit != null) && (
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[var(--text-mute)]">
            P&amp;L — últimos 12 meses (TTM)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.totalRevenue    != null && <MetricCard label="Ingresos"       value={fmtBig(data.totalRevenue)} {...metaProps("totalRevenue")} />}
            {data.grossProfit     != null && <MetricCard label="Gan. bruta"     value={fmtBig(data.grossProfit)}  {...metaProps("grossProfit")} />}
            {data.ebitda          != null && <MetricCard label="EBITDA"         value={fmtBig(data.ebitda)} highlight {...metaProps("ebitda")} />}
            {data.ebit            != null && <MetricCard label="EBIT"           value={fmtBig(data.ebit)} {...metaProps("ebit")} />}
            {data.netIncome       != null && <MetricCard label="Gan. neta"      value={fmtBig(data.netIncome)} {...metaProps("netIncome")} />}
            {data.operatingCashflow != null && <MetricCard label="FCO"          value={fmtBig(data.operatingCashflow)} {...metaProps("operatingCashflow")} />}
            {data.freeCashflow    != null && <MetricCard label="FCF"            value={fmtBig(data.freeCashflow)} highlight {...metaProps("freeCashflow")} />}
            {data.totalDebt       != null && <MetricCard label="Deuda total"    value={fmtBig(data.totalDebt)} {...metaProps("totalDebt")} />}
          </div>
        </div>
      )}

      {/* Márgenes y retornos */}
      {(kind === "accion" || kind === "accion_usa") && (data.ebitdaMargin != null || data.grossMargin != null || data.returnOnEquity != null) && (
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-[var(--text-mute)]">
            Márgenes y retornos
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.grossMargin     != null && <MetricCard label="Mg. bruto"     value={fmtPct(data.grossMargin)} {...metaProps("grossMargin")} />}
            {data.ebitdaMargin    != null && <MetricCard label="Mg. EBITDA"    value={fmtPct(data.ebitdaMargin)} {...metaProps("ebitdaMargin")} />}
            {data.operatingMargin != null && <MetricCard label="Mg. operativo" value={fmtPct(data.operatingMargin)} {...metaProps("operatingMargin")} />}
            {data.profitMargin    != null && <MetricCard label="Mg. neto"      value={fmtPct(data.profitMargin)} {...metaProps("profitMargin")} />}
            {data.revenueGrowth   != null && <MetricCard label="Crecim. Rev."  value={fmtPct(data.revenueGrowth)} {...metaProps("revenueGrowth")} />}
            {data.earningsGrowth  != null && <MetricCard label="Crecim. EPS"   value={fmtPct(data.earningsGrowth)} {...metaProps("earningsGrowth")} />}
            {data.returnOnEquity  != null && <MetricCard label="ROE"           value={fmtPct(data.returnOnEquity)} {...metaProps("returnOnEquity")} />}
            {data.returnOnAssets  != null && <MetricCard label="ROA"           value={fmtPct(data.returnOnAssets)} {...metaProps("returnOnAssets")} />}
          </div>
        </div>
      )}

      {/* Perfil de la empresa */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3">
        {/* Chips de sector / industria */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {data.sector   && <span className="rounded-full border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-2.5 py-0.5 font-mono text-[9px] text-[var(--amber)]">{data.sector}</span>}
          {data.industry && <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 font-mono text-[9px] text-[var(--text-dim)]">{data.industry}</span>}
        </div>

        {/* Detalles */}
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {data.city && (
            <div className="flex items-center gap-1 font-mono text-[9px] text-[var(--text-mute)]">
              <Building2 size={10} />
              <span>{data.city}, {data.country}</span>
            </div>
          )}
          {data.employees && (
            <div className="flex items-center gap-1 font-mono text-[9px] text-[var(--text-mute)]">
              <Users size={10} />
              <span>{data.employees.toLocaleString("es-AR")} empleados</span>
            </div>
          )}
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[9px] text-[var(--amber)] hover:underline"
            >
              <Globe size={10} />
              <span>Sitio web</span>
              <ExternalLink size={8} />
            </a>
          )}
        </div>

        {/* Descripción */}
        {data.description && (
          <div>
            <p
              className={cn(
                "font-sans text-[10px] leading-relaxed text-[var(--text-dim)]",
                !descExpanded && "line-clamp-3",
              )}
            >
              {data.description}
            </p>
            <button
              onClick={() => setDescExpanded((v) => !v)}
              className="mt-1 font-mono text-[9px] text-[var(--amber)] hover:underline"
            >
              {descExpanded ? "Mostrar menos" : "Leer más"}
            </button>
          </div>
        )}
      </div>

      <div className="pb-2 text-center font-mono text-[8px] leading-relaxed text-[var(--text-mute)]">
        Datos: Yahoo Finance · Precios con demora · Solo informativo
        {data.fuente_efectiva && <><br />Fuente efectiva: {data.fuente_efectiva}</>}
        {data.fecha_actualizacion && (
          <><br />Actualizado: {new Date(data.fecha_actualizacion).toLocaleString("es-AR")}</>
        )}
      </div>
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export interface EmpresaDrawerProps {
  ticker: string | null
  kind: TickerKind
  onClose: () => void
}

export function EmpresaDrawer({ ticker, kind, onClose }: EmpresaDrawerProps) {
  const open = ticker != null

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-[81] flex h-full w-full max-w-[500px] flex-col border-l border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header fijo */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <span className="rounded-md bg-[var(--amber-soft)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--amber)]">
            {ticker ?? "—"}
          </span>
          <div className="flex-1 min-w-0 font-mono text-[10px] uppercase tracking-wider text-[var(--text-mute)]">
            {kind === "accion" ? "Acción" : kind === "bono" ? "Bono soberano" : kind.toUpperCase()}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-mute)] hover:border-[var(--border-hi)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {ticker != null && <EmpresaContent ticker={ticker} kind={kind} />}
        </div>
      </div>
    </>
  )
}
