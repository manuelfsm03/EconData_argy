"use client"

const PASOS = [
  {
    titulo: "Entrá sin cuenta",
    texto: "El panel es de acceso libre y no necesita datos personales para empezar.",
  },
  {
    titulo: "Armá tu Pizarra",
    texto: "Elegí tarjetas de la Biblioteca y ordenalas según lo que estés siguiendo.",
  },
  {
    titulo: "Llevátela a tu agente",
    texto: "Consultá los datos desde Claude, Codex u otro cliente compatible con MCP.",
  },
]

export function HeroPrimerosPasos() {
  return (
    <div className="landing-steps">
      <div className="landing-use-label"><span>02</span> Cómo se usa</div>
      <ol>
        {PASOS.map(({ titulo, texto }, index) => (
          <li key={titulo}>
            <span>{index + 1}</span>
            <div><h3>{titulo}</h3><p>{texto}</p></div>
          </li>
        ))}
      </ol>
    </div>
  )
}
