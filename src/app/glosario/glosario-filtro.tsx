"use client"

/**
 * GlosarioFiltro — buscador + filtro por categoría del /glosario.
 *
 * Server component renderiza toda la biblioteca (SEO-friendly).
 * Este componente client-side muestra/oculta las <li data-term-id="…"> vía
 * `element.style.display` — sin re-renderizar la lista completa.
 */

import { useEffect, useMemo, useState } from "react"

interface Termino {
  id: string
  slug: string
  nombre: string
  sigla: string
  definicion: string
  categoria: string
}

interface CategoriaTag {
  key: string
  label: string
  count: number
}

export function GlosarioFiltro({
  terminos,
  categorias,
}: {
  terminos: Termino[]
  categorias: CategoriaTag[]
}) {
  const [query, setQuery] = useState("")
  const [categoriaSel, setCategoriaSel] = useState<string>("all")
  const [resultCount, setResultCount] = useState<number>(terminos.length)

  const q = query.trim().toLowerCase()

  // Aplica el filtro DOM directo — evita reconstruir el JSX de todo el server render.
  useEffect(() => {
    if (typeof document === "undefined") return

    const items = document.querySelectorAll<HTMLElement>("li[data-term-id]")
    let visibles = 0
    items.forEach((li) => {
      const cat = li.parentElement?.parentElement?.getAttribute("data-categoria") ?? ""
      const match =
        (categoriaSel === "all" || cat === categoriaSel) &&
        (q === "" || (li.getAttribute("data-term-search") ?? "").includes(q))
      li.style.display = match ? "" : "none"
      if (match) visibles += 1
    })

    // Ocultar secciones que quedaron sin ningún item visible.
    const secciones = document.querySelectorAll<HTMLElement>("section[data-categoria]")
    secciones.forEach((s) => {
      const catKey = s.getAttribute("data-categoria")
      const anyVisible = Array.from(s.querySelectorAll<HTMLElement>("li[data-term-id]"))
        .some((el) => el.style.display !== "none")
      const catFilterOn = categoriaSel !== "all" && categoriaSel !== catKey
      s.style.display = !anyVisible || catFilterOn ? "none" : ""
    })

    setResultCount(visibles)
  }, [q, categoriaSel])

  const totalCategorias = useMemo(
    () => [{ key: "all", label: "Todas", count: terminos.length }, ...categorias],
    [categorias, terminos.length],
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Buscar término (ej. LECAP, CER, riesgo país, duration)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar término del glosario"
          style={{
            flex: "1 1 320px",
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            padding: "10px 14px",
            color: "var(--text)",
            fontSize: 14,
            fontFamily: "var(--font-mono, monospace)",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
          {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {totalCategorias.map((c) => {
          const active = categoriaSel === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategoriaSel(c.key)}
              style={{
                background: active ? "rgba(255,160,40,0.12)" : "transparent",
                color: active ? "var(--amber, #FFA028)" : "var(--text-dim)",
                border: active ? "1px solid rgba(255,160,40,0.5)" : "1px solid var(--border)",
                borderRadius: 20,
                padding: "5px 12px",
                fontSize: 10.5,
                fontWeight: active ? 600 : 400,
                textTransform: "uppercase",
                letterSpacing: 1,
                cursor: "pointer",
                fontFamily: "var(--font-mono, monospace)",
                transition: "all 0.15s",
              }}
            >
              {c.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{c.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
