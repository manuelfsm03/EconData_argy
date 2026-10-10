/**
 * /glosario — Biblioteca educativa de indicadores argentinos.
 *
 * Server component (SEO-friendly): renderiza todos los términos del GLOSSARY
 * agrupados por categoría. El buscador en vivo lo maneja un client component
 * chico (GlosarioFiltro).
 *
 * Ruta: /glosario   |   Anchor por término: /glosario#slug
 */

import type { Metadata } from "next"
import Link from "next/link"
import { GLOSSARY, CATEGORIA_LABEL, slugTermino, type GlossaryCategoria } from "@/lib/glossary"
import { GlosarioFiltro } from "./glosario-filtro"

export const metadata: Metadata = {
  title: "Glosario económico | La Pizarra",
  description:
    "Diccionario de indicadores económicos y financieros argentinos: inflación, tasas, bonos, dólares y más. Definiciones cortas, ejemplos y fuentes oficiales.",
}

const CATEGORIAS_ORDEN: GlossaryCategoria[] = [
  "cambiario",
  "inflacion",
  "tasas",
  "monetario",
  "instrumento",
  "renta-fija",
  "renta-variable",
  "commodities",
  "actividad",
  "sector-externo",
  "fiscal",
  "teoria",
]

export default function GlosarioPage() {
  // Agrupar términos por categoría (los sin categoría van a "otros")
  const grupos = new Map<string, { id: string; term: (typeof GLOSSARY)[string] }[]>()
  for (const [id, term] of Object.entries(GLOSSARY)) {
    const key = term.categoria ?? "otros"
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push({ id, term })
  }
  // Orden alfabético dentro de cada grupo
  for (const list of grupos.values()) {
    list.sort((a, b) => (a.term.nombre ?? a.id).localeCompare(b.term.nombre ?? b.id, "es"))
  }

  const total = Object.keys(GLOSSARY).length

  // Serializamos los datos para el filtro (client component).
  const todos = Object.entries(GLOSSARY).map(([id, term]) => ({
    id,
    slug: slugTermino(id),
    nombre: term.nombre ?? id,
    sigla: term.sigla ?? "",
    definicion: term.text,
    categoria: term.categoria ?? "otros",
  }))

  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "36px 20px 96px",
        fontFamily: "var(--font-sans, system-ui)",
        color: "var(--text)",
      }}
    >
      <header style={{ borderBottom: "1px solid var(--border)", paddingBottom: 20, marginBottom: 28 }}>
        <p style={{ fontSize: 11, color: "var(--amber, #FFA028)", letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
          La Pizarra · Educación
        </p>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            margin: "6px 0 10px",
            fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
          }}
        >
          Glosario económico argentino
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.55, margin: 0 }}>
          {total} términos con definiciones cortas, ejemplos y links a la fuente oficial. Todo lo que
          aparece en los dashboards, explicado en criollo.
        </p>
      </header>

      {/* Buscador + índice por categoría */}
      <GlosarioFiltro
        terminos={todos}
        categorias={CATEGORIAS_ORDEN
          .filter((c) => grupos.has(c))
          .map((c) => ({ key: c, label: CATEGORIA_LABEL[c], count: grupos.get(c)?.length ?? 0 }))}
      />

      {/* Renderizado server: todas las categorías (para SEO). El filtro client
          decide cuáles quedan visibles vía data-attributes. */}
      <div style={{ marginTop: 28 }}>
        {CATEGORIAS_ORDEN.filter((c) => grupos.has(c)).map((catKey) => (
          <section
            key={catKey}
            data-categoria={catKey}
            style={{ marginBottom: 40 }}
          >
            <h2
              id={`cat-${catKey}`}
              style={{
                fontSize: 12,
                color: "var(--amber, #FFA028)",
                letterSpacing: 2,
                textTransform: "uppercase",
                borderBottom: "1px solid var(--border)",
                paddingBottom: 8,
                marginBottom: 16,
              }}
            >
              {CATEGORIA_LABEL[catKey]} <span style={{ color: "var(--text-dim)" }}>· {grupos.get(catKey)?.length}</span>
            </h2>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
              {grupos.get(catKey)?.map(({ id, term }) => {
                const slug = slugTermino(id)
                const nombre = term.nombre ?? id
                return (
                  <li
                    key={id}
                    id={slug}
                    data-term-id={id}
                    data-term-search={`${nombre} ${term.sigla ?? ""} ${id} ${term.text}`.toLowerCase()}
                    style={{
                      background: "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      padding: "14px 16px",
                      scrollMarginTop: 20,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          margin: 0,
                          fontFamily: "var(--font-mono, monospace)",
                          color: "var(--text)",
                        }}
                      >
                        {nombre}
                        {term.sigla && term.sigla !== nombre && (
                          <span style={{ color: "var(--text-dim)", marginLeft: 8, fontWeight: 400 }}>
                            · {term.sigla}
                          </span>
                        )}
                      </h3>
                      <Link
                        href={`#${slug}`}
                        style={{ color: "var(--text-dim)", fontSize: 11, textDecoration: "none" }}
                      >
                        #{slug}
                      </Link>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, margin: "8px 0 0" }}>
                      {term.text}
                    </p>
                    {term.ejemplo && (
                      <p
                        style={{
                          fontSize: 12.5,
                          color: "var(--text-dim)",
                          lineHeight: 1.55,
                          margin: "8px 0 0",
                          borderLeft: "2px solid var(--amber, #FFA028)",
                          paddingLeft: 10,
                        }}
                      >
                        <strong style={{ color: "var(--amber, #FFA028)" }}>Ejemplo. </strong>
                        {term.ejemplo}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "10px 0 0", fontStyle: "italic" }}>
                      Fuente:{" "}
                      {term.url ? (
                        <a
                          href={term.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--amber, #FFA028)", textDecoration: "none" }}
                        >
                          {term.source} ↗
                        </a>
                      ) : (
                        term.source
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <footer style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 40, color: "var(--text-dim)", fontSize: 11 }}>
        <p style={{ margin: 0 }}>
          ¿Falta un término? Este glosario crece junto con los dashboards.{" "}
          <Link href="/" style={{ color: "var(--amber, #FFA028)" }}>
            Volver al inicio
          </Link>
          .
        </p>
      </footer>
    </main>
  )
}
