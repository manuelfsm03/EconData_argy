"use client"

/**
 * /glosario — todos los términos ya definidos en src/lib/glossary.ts
 * (el mismo diccionario que alimenta los tooltips "?" de todo el panel),
 * en una sola página navegable con buscador simple.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { GLOSSARY } from "@/lib/glossary"

export default function GlosarioPage() {
  const [busqueda, setBusqueda] = useState("")

  const terminos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return Object.entries(GLOSSARY)
      .filter(([clave, entrada]) => !q || clave.toLowerCase().includes(q) || entrada.text.toLowerCase().includes(q))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [busqueda])

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/" className="text-xs text-[var(--text-dim)] hover:text-[var(--amber)]">← La Pizarra</Link>
      <h1 className="mt-4 text-3xl font-bold text-[var(--text)]">Glosario</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">
        Los {Object.keys(GLOSSARY).length} términos que explican los datos del panel, con la fuente oficial de cada definición.
      </p>

      <input
        type="text"
        placeholder="Buscar un término…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="mt-6 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--amber)]"
      />

      <div className="mt-8 space-y-6">
        {terminos.map(([clave, entrada]) => (
          <div key={clave} className="border-b border-[var(--border)] pb-4">
            <div className="text-sm font-semibold text-[var(--text)]">{clave}</div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">{entrada.text}</p>
            <a href={entrada.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[10px] text-[var(--text-mute)] hover:text-[var(--amber)]">
              Fuente: {entrada.source}
            </a>
          </div>
        ))}
        {terminos.length === 0 && (
          <p className="text-sm text-[var(--text-dim)]">Ningún término coincide con &quot;{busqueda}&quot;.</p>
        )}
      </div>
    </div>
  )
}
