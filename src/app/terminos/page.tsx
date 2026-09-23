import Link from "next/link"

/**
 * Stub honesto, no un texto legal inventado: La Pizarra todavía no tiene
 * términos de uso redactados formalmente. Mejor decir eso que fabricar un
 * documento legal que nadie revisó.
 */
export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/" className="text-xs text-[var(--text-dim)] hover:text-[var(--amber)]">← La Pizarra</Link>
      <h1 className="mt-4 text-2xl font-bold text-[var(--text)]">Términos de uso</h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text-dim)]">
        Todavía no redactamos unos términos de uso formales. Lo que sí es firme, mientras tanto:
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--text-dim)]">
        <li>La Pizarra es un proyecto independiente, no un bróker ni un agente regulado.</li>
        <li>Nada de lo publicado en el panel constituye asesoramiento financiero.</li>
        <li>Los datos provienen de fuentes públicas y pueden tener demora o errores de las fuentes originales.</li>
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text-dim)]">
        Si usás La Pizarra para tomar una decisión de inversión, hacelo bajo tu propio criterio.
      </p>
    </div>
  )
}
