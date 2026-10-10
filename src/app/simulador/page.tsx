import type { Metadata } from "next"
import { SimuladorClient } from "@/client/components/simulador/simulador-client"

export const metadata: Metadata = {
  title: "Simulador de escenarios — La Pizarra",
  description:
    "¿Qué pasa con tu plata si el dólar sube, la inflación se acelera o el BCRA baja las tasas? Simulá escenarios cambiarios y compará instrumentos.",
  openGraph: {
    title: "Simulador de escenarios — La Pizarra",
    description:
      "Simulá dólar, inflación y TPM y comparé plazo fijo, UVA, LECAP, dollar-linked, CER y MEP.",
    type: "website",
  },
}

export const dynamic = "force-dynamic"

export default function SimuladorPage() {
  return <SimuladorClient />
}
