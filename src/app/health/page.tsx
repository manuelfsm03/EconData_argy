import type { Metadata } from "next"
import { HealthDashboard } from "@/client/components/health/health-dashboard"

export const metadata: Metadata = {
  title: "Health de datos · La Pizarra",
  description: "Estado en runtime de fuentes y tarjetas de La Pizarra",
}

export default function HealthPage() {
  return <HealthDashboard />
}
