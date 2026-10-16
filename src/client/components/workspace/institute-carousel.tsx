"use client"

/**
 * InstituteCarousel — cinta con logos institucionales en loop infinito (marquee).
 *
 * Curado a propósito, no es la lista completa de fuentes del registry (son
 * más de 40, entre bancos centrales y agregadores técnicos chicos como
 * DolarAPI o CriptoYa): acá van las instituciones reconocibles — las mismas
 * que el equipo nombró en el speech del EGD 2026 (BCRA, INDEC, organismos
 * internacionales) más los bancos centrales y fuentes de mercado que
 * consume src/server/sources/registry.ts. Meter las 40 haría ruido, no
 * credibilidad.
 *
 * Cada logo va en una tarjeta blanca con su nombre debajo: los PNG vienen
 * de favicons oficiales de cada sitio, no todos con fondo transparente
 * consistente — la tarjeta pareja resuelve eso sin retocar cada imagen a
 * mano, y el nombre explícito evita que alguien tenga que adivinar un
 * ícono que no reconoce.
 *
 * El loop infinito se logra duplicando la lista una vez y animando el
 * conjunto -50% con CSS puro. La duración escala con la cantidad de logos
 * para que la velocidad (no el tiempo total) se sienta igual sea cual sea
 * el tamaño de la lista.
 */

const INSTITUCIONES = [
  { nombre: "BCRA", archivo: "bcra.png" },
  { nombre: "INDEC", archivo: "indec.png" },
  { nombre: "Ministerio de Economía", archivo: "economia.png" },
  { nombre: "BYMA", archivo: "byma.png" },
  { nombre: "Rava Bursátil", archivo: "rava.png" },
  { nombre: "Federal Reserve", archivo: "fed.png" },
  { nombre: "Banco Central Europeo", archivo: "ecb.png" },
  { nombre: "Banco Mundial", archivo: "worldbank.png" },
  { nombre: "OCDE", archivo: "oecd.png" },
  { nombre: "Banco de México", archivo: "banxico.png" },
  { nombre: "EIA (EE.UU.)", archivo: "eia.png" },
  { nombre: "Our World in Data", archivo: "owid.png" },
  { nombre: "Yahoo Finance", archivo: "yahoo.png" },
]

const SEGUNDOS_POR_LOGO = 3.2

export function InstituteCarousel() {
  // Se duplica la lista para que, al llegar a -50%, el segundo tramo sea
  // idéntico al primero y el corte del loop no se note.
  const tanda = [...INSTITUCIONES, ...INSTITUCIONES]
  const duracion = INSTITUCIONES.length * SEGUNDOS_POR_LOGO

  return (
    <div className="marquee-viewport group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div
        className="motion-safe-anim flex w-max gap-4 group-hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${duracion}s linear infinite` }}
      >
        {tanda.map((inst, i) => (
          <div key={`${inst.nombre}-${i}`} className="flex w-28 shrink-0 flex-col items-center gap-1.5">
            <div className="flex h-16 w-full items-center justify-center rounded-lg border border-black/5 bg-white p-3 shadow-sm">
              {/* <img> simple a propósito: son assets locales chicos (~2-6 KB
                  cada uno), no vale la pena el overhead de next/image acá. */}
              <img
                src={`/instituciones/${inst.archivo}`}
                alt={inst.nombre}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <span className="text-center text-[9px] leading-tight text-[var(--text-mute)]">{inst.nombre}</span>
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
