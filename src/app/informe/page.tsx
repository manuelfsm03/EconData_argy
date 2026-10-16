/**
 * /informe — Informe semanal de La Pizarra (prototipo).
 *
 * El molde del semanal de 5 páginas con formato 1816, armado con NUESTROS datos:
 * una página A4 por tema, 2 a 4 gráficos por tema, y al pie de cada gráfico la
 * fuente (del registro src/server/sources/registry.ts) y la fecha del último dato.
 *
 * - El texto editorial lo escribe el equipo en content/informes/<AAAA>-S<semana>.md.
 *   NO lo genera ninguna IA. Sección sin texto = el gráfico va solo.
 * - Qué gráfico sale de qué endpoint: src/lib/informe/secciones.ts. Lo que todavía
 *   no está en main aparece como recuadro "pendiente" con su rama; nunca hay mocks.
 * - Se imprime con "Imprimir -> Guardar como PDF" (A4, un salto de página por sección).
 *
 * Query opcional: /informe?semana=2026-S42 para ver un informe anterior.
 */

import type { Metadata } from "next"
import { headers } from "next/headers"

import { InformeChart } from "@/client/components/informe/informe-chart"
import { BotonImprimir } from "@/client/components/informe/boton-imprimir"
import { formatearValor, type ResultadoTabla } from "@/lib/informe/extractores"
import { cargarInforme, type GraficoRender, type SeccionRender } from "@/lib/informe/cargar"
import { bloquesDeTexto } from "@/lib/informe/markdown"
import "./informe.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Informe semanal | La Pizarra",
  description: "Informe de coyuntura semanal de La Pizarra: cada número declara su fuente y la fecha del último dato.",
}

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-")
  return d ? `${d}/${m}/${a}` : `${m}/${a}` // AAAA-MM (dato mensual) -> MM/AAAA
}

function origenDeLaApp(): string {
  const base = process.env.INFORME_BASE_URL
  if (base) return base.replace(/\/+$/, "")
  const h = headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

function Tabla({ t }: { t: ResultadoTabla }) {
  return (
    <div className={`informe-tabla-wrap${t.compacta ? " compacta" : ""}`}>
      <table className="informe-tabla">
        <thead>
          <tr>
            {t.columnas.map((c) => (
              <th key={c.key} className={c.formato === "texto" ? "izq" : "der"}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.filas.map((fila, i) => (
            <tr key={i}>
              {t.columnas.map((c) => (
                <td key={c.key} className={c.formato === "texto" ? "izq" : "der"}>{formatearValor(fila[c.key], c.formato)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PieDeGrafico({ g }: { g: GraficoRender }) {
  const r = g.resultado
  const ultima = r && r.tipo !== "vacio" ? r.ultimaFecha : null
  const fuenteTxt = g.fuente ? `${g.fuente.nombre} (${g.fuente.publisher})` : "fuente sin registrar"
  let frescuraTxt = "sin fecha de último dato"
  if (r && r.tipo !== "vacio" && ultima) {
    if (r.fechaTipo === "consulta") {
      frescuraTxt = `consulta del ${fechaLarga(ultima)} (la fuente no informa fecha de precio)`
    } else if (g.frescura && g.frescura.edadDias !== null) {
      const unidad = g.frescura.habiles ? "d. hábiles" : "d."
      const estado = g.frescura.estado === "atrasado" ? " · atrasado respecto de la ventana de frescura de la fuente" : ""
      frescuraTxt = `último dato ${fechaLarga(ultima)} (${g.frescura.edadDias} ${unidad} antes del corte)${estado}`
    } else {
      frescuraTxt = `último dato ${fechaLarga(ultima)}`
    }
  }
  return (
    <div className="informe-pie">
      <div><strong>Fuente:</strong> {fuenteTxt}{g.fuente ? <span className="id-fuente"> [{g.fuente.id}]</span> : null}</div>
      <div><strong>Frescura:</strong> {frescuraTxt}</div>
      {r && r.tipo !== "vacio" && r.fuenteEndpoint && ![g.fuente?.id, g.fuente?.nombre, g.fuente?.publisher].includes(r.fuenteEndpoint) ? <div className="detalle">Detalle de la fuente: {r.fuenteEndpoint}</div> : null}
      {g.def.nota ? <div className="detalle">{g.def.nota}</div> : null}
    </div>
  )
}

function Grafico({ g }: { g: GraficoRender }) {
  const r = g.resultado

  if (g.def.estado === "pendiente") {
    return (
      <figure className="informe-grafico">
        <div className="informe-hueco pendiente">
          <div className="hueco-titulo">{g.def.titulo}</div>
          <div className="hueco-estado">
            {g.def.rama?.startsWith("sin rama")
              ? <>Pendiente: {g.def.rama}</>
              : <>Pendiente: entra con la rama <code>{g.def.rama}</code></>}
          </div>
          <div className="hueco-detalle">Todavía no está en main. No se muestran datos de ejemplo.</div>
        </div>
        <div className="informe-pie">
          <div><strong>Fuente prevista:</strong> {g.fuente ? `${g.fuente.nombre} (${g.fuente.publisher})` : "a definir"}</div>
        </div>
      </figure>
    )
  }

  if (!r || r.tipo === "vacio") {
    return (
      <figure className="informe-grafico">
        <div className="informe-hueco sin-datos">
          <div className="hueco-titulo">{g.def.titulo}</div>
          <div className="hueco-estado">Dato no disponible en este momento</div>
          <div className="hueco-detalle">{r?.motivo ?? "Sin respuesta del endpoint."}</div>
        </div>
        <PieDeGrafico g={g} />
      </figure>
    )
  }

  return (
    <figure className="informe-grafico">
      {r.tipo === "tabla" ? (
        <div className="bbg-panel">
          <div className="bbg-panel-header">{g.def.titulo}</div>
          <Tabla t={r} />
        </div>
      ) : (
        <InformeChart titulo={g.def.titulo} serie={r} />
      )}
      <PieDeGrafico g={g} />
    </figure>
  )
}

function Seccion({ s, indice, fechaCorte, semana, anio }: { s: SeccionRender; indice: number; fechaCorte: string; semana: number; anio: number }) {
  const bloques = s.texto ? bloquesDeTexto(s.texto) : []
  return (
    <section className="informe-pagina" id={s.def.id}>
      <header className="informe-encabezado">
        <span>La Pizarra · Informe semanal · semana {semana}/{anio} · corte {fechaLarga(fechaCorte)}</span>
        <span>{indice + 1} / 5</span>
      </header>
      <h2 className="informe-titulo-seccion"><span className="num">{String(indice + 1).padStart(2, "0")}</span> {s.def.titulo}</h2>

      {bloques.length > 0 && (
        <div className="informe-texto">
          {bloques.map((b, i) =>
            b.tipo === "lista" ? (
              <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
            ) : (
              <p key={i}>{b.texto}</p>
            ),
          )}
        </div>
      )}

      <div className="informe-grilla">
        {s.graficos.map((g) => <Grafico key={g.def.id} g={g} />)}
      </div>
    </section>
  )
}

export default async function InformePage({ searchParams }: { searchParams: { semana?: string } }) {
  const informe = await cargarInforme(origenDeLaApp(), searchParams.semana)
  const sinTexto = informe.secciones.every((s) => s.texto === null)

  return (
    <div className="informe-raiz" data-theme="light">
      <div className="informe-herramientas no-imprimir">
        <div>
          {informe.archivo
            ? <>Texto editorial: <code>content/informes/{informe.archivo}</code></>
            : <>Sin texto editorial todavía: se muestran solo los gráficos. Copiá <code>content/informes/PLANTILLA.md</code> a <code>content/informes/{informe.anio}-S{informe.semana}.md</code> para escribir el informe.</>}
          {informe.desconocidas.length > 0 && (
            <div className="aviso">Encabezados ignorados (no son una sección válida): {informe.desconocidas.join(", ")}</div>
          )}
          {searchParams.semana && !informe.archivo && (
            <div className="aviso">No existe content/informes/{searchParams.semana}.md; se muestra la semana actual sin texto.</div>
          )}
        </div>
        <BotonImprimir />
      </div>

      <div className="informe-documento">
        <div className="informe-portada">
          <div className="informe-encabezado">
            <span>La Pizarra · Informe semanal · semana {informe.semana}/{informe.anio} · corte {fechaLarga(informe.fechaCorte)}</span>
            <span>1 / 5</span>
          </div>
          <h1>{informe.titulo ?? "Informe semanal de coyuntura"}</h1>
          <p className="informe-lema">
            Cada gráfico declara su fuente y la fecha de su último dato.
            {sinTexto ? " Este informe todavía no tiene texto editorial." : " El texto fue escrito por el equipo; no está generado por IA."}
          </p>
        </div>

        {informe.secciones.map((s, i) => (
          <Seccion key={s.def.id} s={s} indice={i} fechaCorte={informe.fechaCorte} semana={informe.semana} anio={informe.anio} />
        ))}
      </div>
    </div>
  )
}
