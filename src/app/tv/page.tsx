/**
 * /tv — Modo TV fullscreen
 *
 * Ruta independiente sin nav/sidebar. Renderiza TvMode (client component)
 * con carga dinámica para evitar SSR de hooks del navegador.
 */

import dynamic from "next/dynamic"

const TvMode = dynamic(
  () => import("@/client/components/tv/TvMode").then((m) => ({ default: m.TvMode })),
  { ssr: false },
)

export default function TvPage() {
  return <TvMode />
}

export const metadata = {
  title: "Modo TV · La Pizarra",
}
