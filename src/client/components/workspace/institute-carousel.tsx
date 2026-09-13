"use client"

/**
 * InstituteCarousel — cinta con logo institucional en loop infinito (marquee).
 *
 * Cada logo va en una tarjeta blanca: los PNG vienen de fuentes distintas
 * (favicons oficiales de cada sitio) y no todos tienen fondo transparente
 * consistente — la tarjeta pareja resuelve eso sin tener que retocar cada
 * imagen a mano.
 *
 * El loop infinito se logra duplicando la lista una vez y animando el
 * conjunto -50% con CSS puro: no hace falta una librería de carousel para
 * esto. Se pausa al pasar el mouse, para poder leer un logo puntual.
 */

const INSTITUCIONES = [
  { nombre: "BCRA", archivo: "bcra.png" },
  { nombre: "INDEC", archivo: "indec.png" },
  { nombre: "Ministerio de Economía", archivo: "economia.png" },
  { nombre: "BYMA", archivo: "byma.png" },
  { nombre: "Rava Bursátil", archivo: "rava.png" },
]

export function InstituteCarousel() {
  // Se duplica la lista para que, al llegar a -50%, el segundo tramo sea
  // idéntico al primero y el corte del loop no se note.
  const tanda = [...INSTITUCIONES, ...INSTITUCIONES]

  return (
    <div className="group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-[marquee_22s_linear_infinite] gap-4 group-hover:[animation-play-state:paused]">
        {tanda.map((inst, i) => (
          <div
            key={`${inst.nombre}-${i}`}
            title={inst.nombre}
            className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white p-3"
          >
            {/* <img> simple a propósito: son assets locales chicos (~2-6 KB
                cada uno), no vale la pena el overhead de next/image acá. */}
            <img
              src={`/instituciones/${inst.archivo}`}
              alt={inst.nombre}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
