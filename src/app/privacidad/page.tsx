import Link from "next/link"

/**
 * Igual criterio que /terminos: reflejar lo que la app realmente hace hoy,
 * no un texto legal genérico copiado de otro lado.
 */
export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-xs text-[var(--text-dim)] hover:text-[var(--amber)]">← La Pizarra</Link>
      <h1 className="mt-4 text-2xl font-bold text-[var(--text)]">Privacidad</h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text-dim)]">
        Hoy, sin cuenta creada, La Pizarra no te pide ni guarda datos personales. Lo que sí pasa:
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--text-dim)]">
        <li>Tu propio tablero (qué tarjetas armaste, en qué orden) se guarda en tu navegador, en este dispositivo — no en un servidor.</li>
        <li>No usamos cookies de rastreo ni vendemos datos a terceros.</li>
        <li>Cuando el registro de usuarios esté activo, vas a poder crear una cuenta para guardar tu tablero entre dispositivos y participar del foro — vamos a actualizar esta página con el detalle antes de que eso esté disponible.</li>
      </ul>
    </div>
  )
}
