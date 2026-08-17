"use client"

/**
 * Mapa de calor de acciones estilo Rava: paneles separados por Panel Líder
 * (los tickers más líquidos, MERVAL_TOP) y Panel General (el resto),
 * tamaño de celda por volumen operado y color por variación diaria.
 *
 * Reusa StockQuote de tab-finanzas.tsx (mismo fetch de AccionesView, esto es
 * puramente presentacional -- no pega a la API por su cuenta).
 */
import { ResponsiveContainer, Treemap } from "recharts"
import type { TreemapNode } from "recharts/types/chart/Treemap"
import { MERVAL_TOP } from "@/server/domain/stock-categories"
import type { StockQuote } from "./tab-finanzas"

function colorPorVariacion(v: number | null | undefined): string {
  if (v == null) return "var(--bg-elev-2)"
  const base = v >= 0 ? "var(--positive)" : "var(--negative)"
  // Intensidad proporcional a la magnitud del movimiento, tope en ±6% para
  // no perder legibilidad con outliers (ej. una acción que saltó 40%).
  const intensidad = 25 + Math.min(Math.abs(v), 6) * 10 // 25%..85%
  return `color-mix(in srgb, ${base} ${intensidad}%, var(--bg-elev-2))`
}

interface CeldaProps extends Partial<TreemapNode> {
  ticker?: string
  change1D?: number | null
}

function Celda(props: CeldaProps) {
  const { x = 0, y = 0, width = 0, height = 0, ticker, change1D } = props
  if (width < 2 || height < 2) return null
  const mostrarTexto = width > 46 && height > 28
  const mostrarPct = width > 46 && height > 42
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={colorPorVariacion(change1D)} stroke="var(--bg)" strokeWidth={1.5} />
      {mostrarTexto && (
        <text x={x + width / 2} y={y + height / 2 - (mostrarPct ? 6 : 0)} textAnchor="middle" fill="var(--text)" fontSize={Math.min(13, width / 6)} fontWeight={700} fontFamily="var(--font-data)">
          {ticker}
        </text>
      )}
      {mostrarPct && (
        <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="var(--text)" fontSize={10} fontFamily="var(--font-data)" opacity={0.85}>
          {change1D != null ? `${change1D >= 0 ? "+" : ""}${change1D.toFixed(2)}%` : "—"}
        </text>
      )}
    </g>
  )
}

function Panel({ titulo, stocks }: { titulo: string; stocks: StockQuote[] }) {
  const data = stocks
    .filter((s) => s.lastPrice != null)
    .map((s) => ({ name: s.ticker, ticker: s.ticker, change1D: s.change1D, size: Math.max(s.volume ?? 0, 1) }))

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-6 text-center text-xs text-[var(--text-dim)]">
        Sin cotizaciones para {titulo.toLowerCase()}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{titulo}</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" isAnimationActive={false} content={<Celda ticker="" change1D={null} />} />
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function StockHeatmap({ stocks }: { stocks: StockQuote[] }) {
  const lideres = stocks.filter((s) => MERVAL_TOP.includes(s.ticker))
  const generales = stocks.filter((s) => !MERVAL_TOP.includes(s.ticker))

  return (
    <div className="flex flex-col gap-3">
      <div style={{ height: 220 }}><Panel titulo="Panel Líder" stocks={lideres} /></div>
      <div style={{ height: 320 }}><Panel titulo="Panel General" stocks={generales} /></div>
      <p className="px-1 text-[9px] text-[var(--text-mute)]">
        Tamaño de celda ≈ volumen operado · color por variación diaria (más intenso = movimiento más fuerte, tope en ±6%).
      </p>
    </div>
  )
}
