"use client"

import React from "react"

import {
  HeadlinesBlock,
  IPCBlock,
  ReservasBadlarBlock,
  RiesgoPaisBlock,
  TCStrip,
} from "@/client/components/dashboard/tab-resumen"
import {
  AccionesView,
  BonosView,
  CommoditiesView,
  CryptoView,
  MundoView,
  PlazoFijoView as FinanzasPlazoFijoView,
  RofexView,
} from "@/client/components/dashboard/tab-finanzas"
import {
  BalanzaView,
  BigMacView,
  DesigualdadView,
  DeudaView,
  EmaeView,
  FXView,
  IpcView,
  PiramidesView,
  RiesgoPaisView,
  SenorejaView,
} from "@/client/components/dashboard/tab-macro"
import { FiscalSankeyView } from "@/client/components/dashboard/fiscal-sankey"
import {
  AgregadosView,
  BancosView,
  ComprasView,
  PlazoFijoView as BCRAPlazoFijoView,
  REMView,
  ReservasView,
  TasasView,
} from "@/client/components/dashboard/tab-bcra"
import { NewsFeed } from "@/client/components/dashboard/news-feed"
import { DATA_CARD_BY_ID } from "@/lib/card-catalog"
import { AssetScreener } from "@/client/components/dashboard/screener-activos"
import { RateScreener } from "@/client/components/dashboard/screener-tasas"
import { TabBonos } from "@/client/components/dashboard/tab-bonos"
import { TabMundo } from "@/client/components/dashboard/tab-mundo"
import { NumericBoundary } from "./numeric-boundary"
import { NumericEnergyCard } from "./numeric-energy-card"
import { NUMERIC_SURFACE_BY_ID } from "@/server/numeric/manifest"
import type { TickerFocus } from "@/lib/ticker-nav"

const noopNavigate = () => {}

const CARD_COMPONENTS: Record<string, React.ComponentType> = {
  "resumen-tipo-cambio": () => <TCStrip onNavigate={noopNavigate} />,
  "resumen-ipc": () => <IPCBlock onNavigate={noopNavigate} />,
  "resumen-riesgo": () => <RiesgoPaisBlock onNavigate={noopNavigate} />,
  "resumen-reservas": () => <ReservasBadlarBlock onNavigate={noopNavigate} />,
  "resumen-noticias": () => <HeadlinesBlock onNavigate={noopNavigate} />,
  acciones: AccionesView,
  bonos: BonosView,
  "renta-fija-avanzada": TabBonos,
  rofex: RofexView,
  "plazo-fijo-mercado": FinanzasPlazoFijoView,
  commodities: CommoditiesView,
  "mercados-mundo": MundoView,
  "mundo-avanzado": TabMundo,
  cripto: CryptoView,
  "screener-activos": AssetScreener,
  "screener-tasas": RateScreener,
  emae: EmaeView,
  ipc: IpcView,
  balanza: BalanzaView,
  fiscal: FiscalSankeyView,
  desigualdad: DesigualdadView,
  piramides: PiramidesView,
  fx: FXView,
  "big-mac": BigMacView,
  "riesgo-pais": RiesgoPaisView,
  "deuda-publica": DeudaView,
  senoraje: SenorejaView,
  "bcra-plazo-fijo": BCRAPlazoFijoView,
  "bcra-tasas": TasasView,
  "bcra-agregados": AgregadosView,
  "bcra-reservas": ReservasView,
  "bcra-bancos": BancosView,
  "bcra-compras": ComprasView,
  rem: REMView,
  noticias: NewsFeed,
}

export function DataCardRenderer({ cardId, focusTicker = null }: { cardId: string; focusTicker?: TickerFocus | null }) {
  const definition = DATA_CARD_BY_ID.get(cardId)
  if (!definition) return <div className="p-4 text-sm text-[var(--negative)]">Tarjeta no disponible.</div>

  const surface = NUMERIC_SURFACE_BY_ID.get(cardId)
  if (!surface || surface.rendererId !== cardId) {
    return <div className="p-4 text-sm text-[var(--text-dim)]">Dato no disponible.</div>
  }

  // This is the one R2 vertical with a runtime provenance-producing route.
  // Do not unlock the legacy multi-source TabMundo renderer with EIA metadata:
  // its other tabs still lack numeric provenance.
  if (cardId === "mundo-avanzado") {
    return (
      <NumericBoundary cardId={cardId}>
        {(payload) => <NumericEnergyCard payload={payload} />}
      </NumericBoundary>
    )
  }

  const Component = CARD_COMPONENTS[cardId]
  if (Component) {
    return (
      <NumericBoundary cardId={cardId}>
        {cardId === "acciones" ? <AccionesView initialTicker={focusTicker?.ticker ?? null} /> : <Component />}
      </NumericBoundary>
    )
  }

  return <div className="p-4 text-sm text-[var(--text-dim)]">Dato no disponible.</div>
}
