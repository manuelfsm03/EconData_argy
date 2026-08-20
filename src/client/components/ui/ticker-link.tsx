"use client"

import { useState } from "react"
import { CalendarDays, LineChart, MessageSquareText } from "lucide-react"
import { useTickerNav, type TickerKind } from "@/lib/ticker-nav"
import { cn } from "@/lib/utils"

/**
 * Badge de ticker clickeable: abre un menú chico con los 3 destinos
 * cross-sección (precio/histórico, foro, calendario). Pensado para
 * reusar en cualquier lugar donde hoy se muestra un ticker como texto
 * plano (calendario, calculadora de bonos, etc.).
 */
export function TickerLink({ kind, ticker, className, children }: { kind: TickerKind; ticker: string; className?: string; children: React.ReactNode }) {
  const { navigateToTicker } = useTickerNav()
  const [open, setOpen] = useState(false)

  const opciones: { destino: "precio" | "foro" | "calendario"; label: string; Icon: typeof LineChart }[] = [
    { destino: "precio", label: "Ver precio / histórico", Icon: LineChart },
    { destino: "foro", label: "Ver en el Foro", Icon: MessageSquareText },
    { destino: "calendario", label: "Ver en el Calendario", Icon: CalendarDays },
  ]

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={cn("cursor-pointer underline decoration-dotted underline-offset-2 hover:text-[var(--amber)]", className)}
      >
        {children}
      </button>
      {open && (
        <>
          <button type="button" aria-label="Cerrar" onClick={(e) => { e.stopPropagation(); setOpen(false) }} className="fixed inset-0 z-[95]" />
          <div className="absolute left-0 top-full z-[96] mt-1 w-48 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl">
            {opciones.map(({ destino, label, Icon }) => (
              <button
                key={destino}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); navigateToTicker(kind, ticker, destino) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-medium text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
              >
                <Icon size={12} className="text-[var(--amber)]" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}
