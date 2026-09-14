/**
 * Traduce el modelo Prisma `Profile` (fila de Postgres) al contrato `UserProfile`
 * que ya consume el frontend (definido junto a los datos mock).
 *
 * Vive en un solo lugar porque lo usan dos rutas (/api/profiles y
 * /api/profiles/[id]): sin esto, corregir un campo significa acordarse de
 * tocarlo en los dos archivos.
 *
 * Las predicciones quedan explícitamente afuera: predictions/route.ts dice
 * "el reemplazo por persistencia real queda fuera del MVP" — un perfil
 * armado acá no trae `predicciones`, eso sigue viniendo del endpoint mock.
 */

import type { Profile } from "@prisma/client"
import type { BadgeLevel, PerfilRiesgo, UserProfile } from "@/client/components/profiles/mock-profiles"

const NIVELES_VALIDOS = new Set<BadgeLevel>(["Novato", "Analista", "Trader", "Pro", "Experto", "Quant"])
const PERFILES_RIESGO_VALIDOS = new Set<PerfilRiesgo>(["conservador", "moderado", "agresivo"])

/**
 * `nivel` es TEXT libre en la base (nada impide que una migración vieja o un
 * UPDATE manual deje un valor fuera del enum de la app). Ante un valor no
 * reconocido, cae a "Novato" en vez de romper el render — más seguro que
 * confiar ciegamente en un cast.
 */
function validarNivel(nivel: string): BadgeLevel {
  return NIVELES_VALIDOS.has(nivel as BadgeLevel) ? (nivel as BadgeLevel) : "Novato"
}

function validarPerfilRiesgo(perfilRiesgo: string | null): PerfilRiesgo | undefined {
  if (!perfilRiesgo) return undefined
  return PERFILES_RIESGO_VALIDOS.has(perfilRiesgo as PerfilRiesgo) ? (perfilRiesgo as PerfilRiesgo) : undefined
}

/** `topAcciones` es JSONB: valida la forma en vez de asumirla, por si algún día llega vacío o corrupto. */
function validarTopAcciones(valor: unknown): { ticker: string; conviccion: number }[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is { ticker: string; conviccion: number } =>
    typeof item === "object" && item !== null &&
    typeof (item as Record<string, unknown>).ticker === "string" &&
    typeof (item as Record<string, unknown>).conviccion === "number")
}

export function mapProfileToUserProfile(profile: Profile, currentUserId?: string | null): UserProfile {
  return {
    id: profile.id,
    nombre: profile.displayName ?? profile.username,
    handle: profile.username,
    bio: profile.bio,
    linkedin: profile.linkedin ?? undefined,
    foto: profile.avatarUrl ?? undefined,
    avatarBg: profile.avatarBg,
    topAcciones: validarTopAcciones(profile.topAcciones),
    intereses: profile.intereses,
    interesesRentaFija: profile.interesesRentaFija,
    interesesRentaVariable: profile.interesesRentaVariable,
    perfilRiesgo: validarPerfilRiesgo(profile.perfilRiesgo),
    stats: {
      posts: profile.posts,
      seguidores: profile.seguidores,
      aciertos: profile.aciertos,
      totalPrediciones: profile.totalPrediciones,
      puntos: profile.puntos,
    },
    nivel: validarNivel(profile.nivel),
    fechaAlta: profile.fechaAlta.toISOString(),
    streak: profile.streak,
    isCurrentUser: currentUserId != null ? profile.id === currentUserId : undefined,
    // predicciones queda sin definir a propósito: ver el comentario de arriba.
  }
}
