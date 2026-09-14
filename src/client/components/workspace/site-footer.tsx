"use client"

import Image from "next/image"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

// Sin íconos de redes: La Pizarra todavía no tiene cuentas oficiales. Poner
// links inventados sería peor que no poner nada — cuando existan, se agregan.
const LINKS = [
  { href: "/glosario", label: "Glosario" },
  { href: "/#faq", label: "Preguntas frecuentes" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
]

const CAFECITO_URL = "https://cafecito.app/lapizarra"

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

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-[var(--text-dim)] hover:text-[var(--amber)]">
              {link.label}
            </Link>
          ))}
          <a href={CAFECITO_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] hover:text-[var(--amber)]">
            Invitanos un café
          </a>
        </nav>

        <div className="flex max-w-md items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-[var(--amber)]" />
          <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">
            La Pizarra es un proyecto independiente, no un bróker ni un agente regulado. Los datos provienen de fuentes públicas (BCRA, INDEC, BYMA y otras) y pueden tener demora. Nada de lo publicado acá constituye asesoramiento financiero.
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--border-light)] px-6 py-3 text-center text-[10px] text-[var(--text-mute)]">
        © {new Date().getFullYear()} La Pizarra · hecho por el equipo · <Link href="/health" className="text-[var(--sky)] hover:underline">Health de datos</Link>
      </div>
    </footer>
  )
}
