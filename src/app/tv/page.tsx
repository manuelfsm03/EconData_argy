/**
 * /tv — Modo TV fullscreen
 *
 * Ruta independiente sin nav/sidebar. TvMode es un client component:
 * todo lo que depende del navegador (reloj, fullscreen, fetch) corre en
 * useEffect, así que se puede renderizar directo desde este server component.
 */

import type { Metadata } from "next"
import { TvMode } from "@/client/components/tv/TvMode"

export const metadata: Metadata = {
  title: "Modo TV · La Pizarra",
}

export default function TvPage() {
  return <TvMode />
}
