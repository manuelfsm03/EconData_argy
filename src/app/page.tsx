"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { HeroLanding } from "@/client/components/workspace/hero-landing"

const AppShell = dynamic(() => import("@/client/components/workspace/app-shell").then(m => ({ default: m.AppShell })), { ssr: false })

// useSearchParams() opta la ruta a render dinámico y Next exige que esté
// dentro de un <Suspense>, si no falla el build ("missing-suspense-with-csr-bailout").
function HomeInterior() {
  // Un link directo a una sección (?section=agro, compartido o guardado) tiene
  // que aterrizar ahí, no en el hero: quien lo abre ya sabe a dónde va. El hero
  // va ANTES del login (que arma Gonza): hoy no hay sesión real, así que
  // "Entrar al panel" pasa directo al AppShell — cuando el login esté, ese
  // botón es el paso natural hacia /auth/login.
  const searchParams = useSearchParams()
  const [entrado, setEntrado] = useState(false)

  if (!entrado && !searchParams.get("section")) {
    return <HeroLanding onEnter={() => setEntrado(true)} />
  }
  return <AppShell />
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInterior />
    </Suspense>
  )
}
