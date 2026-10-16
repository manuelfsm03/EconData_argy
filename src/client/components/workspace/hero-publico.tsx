"use client"

const PERFILES = [
  {
    titulo: "Si no sos del palo",
    texto: "Contexto claro y lenguaje accesible para entender qué significa cada dato.",
  },
  {
    titulo: "Si estudiás economía",
    texto: "Series oficiales listas para comparar, con fuente y fecha siempre visibles.",
  },
  {
    titulo: "Si ya trabajás con esto",
    texto: "Menos portales abiertos y los mismos datos disponibles desde tu agente de IA.",
  },
]

export function HeroPublico() {
  return (
    <div className="landing-audience">
      <div className="landing-use-label"><span>01</span> A quién le sirve</div>
      <div className="landing-audience-list">
        {PERFILES.map(({ titulo, texto }, index) => (
          <article key={titulo}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><h3>{titulo}</h3><p>{texto}</p></div>
          </article>
        ))}
      </div>
    </div>
  )
}
