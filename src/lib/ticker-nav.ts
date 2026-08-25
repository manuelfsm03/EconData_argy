"use client"

import { createContext, useContext } from "react"

/** Mismo vocabulario que ya usa el Foro (ForumAssetType) -- no se inventa uno nuevo. */
export type TickerKind = "accion" | "accion_usa" | "bono" | "cap" | "variable"

export interface TickerFocus {
  kind: TickerKind
  ticker: string
}

/**
 * Maps a cross-section ticker focus to the library card that can actually
 * represent it. Variable links intentionally have no generic fallback: a
 * ticker with no card-specific semantics must not silently open EMAE.
 */
export function libraryCardIdForTickerFocus(focus: TickerFocus | null | undefined): string | null {
  if (!focus) return null
  if (focus.kind === "accion" || focus.kind === "cap") return "acciones"
  if (focus.kind === "bono") return "bonos"
  return null
}

/** A qué sección saltar cuando se elige un destino para un ticker. */
export type TickerDestino = "precio" | "foro" | "calendario" | "calculadora" | "empresa"

export interface TickerNavigator {
  navigateToTicker: (kind: TickerKind, ticker: string, destino: TickerDestino) => void
}

export const TickerNavContext = createContext<TickerNavigator | null>(null)

/**
 * Devuelve un no-op si se usa fuera de AppShell (en vez de tirar) para no
 * romper renders parciales/tests -- en la app real siempre hay Provider.
 */
export function useTickerNav(): TickerNavigator {
  const ctx = useContext(TickerNavContext)
  return ctx ?? { navigateToTicker: () => {} }
}
