// Server Component — panel de alertas del usuario.
// Requiere sesión Supabase (el middleware redirige a /auth/login si no hay).

import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/server/db/prisma"
import { ALERTAS_ENABLED, USERS_ENABLED } from "@/lib/feature-flags"
import {
  LIMITE_ALERTAS_FREE,
  describirAlerta,
  type AlertaConfig,
  type AlertaTipo,
} from "@/server/domain/alertas"
import AlertasClient from "@/client/components/alertas/alertas-client"

export const dynamic = "force-dynamic"
export const metadata = { title: "Alertas — La Pizarra" }

export default async function AlertasPage() {
  // Hasta que Users esté encendido en prod, la página no existe. Igualmente el
  // middleware redirige a login si no hay sesión.
  if (!ALERTAS_ENABLED || !USERS_ENABLED) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/alertas")

  const alertas = await prisma.alerta.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })

  const enriched = alertas.map((a) => ({
    id:            a.id,
    tipo:          a.tipo as AlertaTipo,
    config:        a.config as unknown as AlertaConfig,
    canal:         a.canal,
    emailDestino:  a.emailDestino,
    estado:        a.estado as "activa" | "pausada" | "disparada",
    ultimoDisparo: a.ultimoDisparo ? a.ultimoDisparo.toISOString() : null,
    createdAt:     a.createdAt.toISOString(),
    descripcion:   describirAlerta(a.tipo as AlertaTipo, a.config as unknown as AlertaConfig),
  }))

  return (
    <AlertasClient
      alertasIniciales={enriched}
      limiteFree={LIMITE_ALERTAS_FREE}
      emailUsuario={user.email ?? ""}
    />
  )
}
