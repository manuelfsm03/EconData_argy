"use client"

import { createContext, useContext } from "react"

/** Mismo vocabulario que ya usa el Foro (ForumAssetType) -- no se inventa uno nuevo. */
export type TickerKind = "accion" | "accion_usa" | "bono" | "cap" | "variable"

export interface TickerFocus {
  kind: TickerKind
  ticker: string
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
