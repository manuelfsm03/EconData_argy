import type { Metadata } from "next"
import { CalendarioCliente } from "@/client/components/calendario/calendario-cliente"

export const metadata: Metadata = {
  title: "Calendario financiero — EconData",
  description:
    "Licitaciones del Tesoro, publicaciones INDEC/BCRA/AFIP, vencimientos de deuda soberana y feriados argentinos. Feed .ics suscribible.",
}

export default function CalendarioPage() {
  return <CalendarioCliente />
}
