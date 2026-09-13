"use client"

/**
 * HeroFAQ — preguntas frecuentes del hero, agrupadas por categoría.
 *
 * Mismo patrón que brajafinanzas.com/preguntas-frecuentes: categorías con
 * encabezado, preguntas ya expandidas debajo (sin acordeón/colapso), tono
 * informal en segunda persona. No es una copia literal del contenido —
 * las preguntas son las de La Pizarra — pero sí la estructura visual.
 */

const CATEGORIAS = [
  {
    titulo: "Producto",
    preguntas: [
      {
        q: "¿Qué es La Pizarra?",
        a: "Un canvas que centraliza datos económicos y financieros de Argentina —tipos de cambio, inflación, bonos, acciones, agro y más— en un solo lugar, con IA que te los explica.",
      },
      {
        q: "¿Es gratis?",
        a: "Sí. Es un proyecto de estudiantes y profesionales de Ciencias Económicas (UBA), sin fines de lucro.",
      },
      {
        q: "¿La Pizarra me da asesoramiento financiero?",
        a: "No. La Pizarra es un proyecto independiente, no un bróker ni un agente regulado. Nada de lo publicado acá constituye asesoramiento financiero.",
      },
    ],
  },
  {
    titulo: "Datos",
    preguntas: [
      {
        q: "¿De dónde salen los datos?",
        a: "De fuentes públicas y oficiales: BCRA, INDEC, Ministerio de Economía, BYMA, Rava Bursátil, entre otras. Cada dato muestra su fuente y la hora en que se actualizó.",
      },
      {
        q: "¿Cada cuánto se actualizan?",
        a: "Depende de la fuente: algunas son en vivo (cotizaciones), otras diarias o mensuales (índices oficiales). Los datos pueden tener demora respecto del momento real.",
      },
      {
        q: "¿Qué pasa si una fuente oficial falla o cambia de formato?",
        a: "Se marca como degradada en el propio dato, no se inventa un número para completar el hueco. Preferimos mostrar que falta información antes que mostrar un dato incorrecto.",
      },
    ],
  },
  {
    titulo: "Uso",
    preguntas: [
      {
        q: "¿Necesito crear una cuenta para usarla?",
        a: "No, hoy no. El panel es de acceso libre. Más adelante va a haber cuentas para guardar tu propio tablero y participar del foro.",
      },
      {
        q: "¿Puedo conectar mi propio agente de IA?",
        a: "Sí, por MCP (Model Context Protocol): es un estándar abierto para que agentes de IA consulten los datos de La Pizarra directamente. Lo encontrás en la sección Conectar.",
      },
    ],
  },
]

export function HeroFAQ() {
  return (
    <div id="faq" className="mt-16 max-w-2xl scroll-mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)]">Preguntas frecuentes</h2>

      <div className="mt-4 space-y-8">
        {CATEGORIAS.map((cat) => (
          <div key={cat.titulo}>
            <div className="border-b border-[var(--border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--amber)]">
              {cat.titulo}
            </div>
            <div className="mt-3 space-y-4">
              {cat.preguntas.map(({ q, a }) => (
                <div key={q}>
                  <div className="text-sm font-medium text-[var(--text)]">{q}</div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">{a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
