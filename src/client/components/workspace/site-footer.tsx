"use client"

import Image from "next/image"
import { ShieldAlert } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-elev)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-sm items-start gap-3">
          <Image src="/logo.png" alt="" width={36} height={30} className="h-8 w-9 shrink-0 object-contain opacity-80" />
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">La Pizarra</div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">
              Canvas de datos económicos y financieros de Argentina: tipos de cambio, inflación, bonos, acciones y más, en un solo lugar.
            </p>
          </div>
        </div>

        <div className="flex max-w-md items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[var(--amber)]" />
          <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">
            La Pizarra es un proyecto independiente, no un bróker ni un agente regulado. Los datos provienen de fuentes públicas (BCRA, INDEC, BYMA y otras) y pueden tener demora. Nada de lo publicado acá constituye asesoramiento financiero.
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--border-light)] px-6 py-3 text-center text-[10px] text-[var(--text-mute)]">
        © {new Date().getFullYear()} La Pizarra · hecho por el equipo
      </div>
    </footer>
  )
}
