"use client"

import { TabResumen } from "@/client/components/dashboard/tab-resumen"
import { TabFinanzas } from "@/client/components/dashboard/tab-finanzas"
import { TabMacro } from "@/client/components/dashboard/tab-macro"
import { TabBCRA } from "@/client/components/dashboard/tab-bcra"
import { NewsFeed } from "@/client/components/dashboard/news-feed"
import { DATA_CARD_BY_ID } from "@/lib/card-catalog"

export function DataCardRenderer({ cardId }: { cardId: string }) {
  const definition = DATA_CARD_BY_ID.get(cardId)
  if (!definition) return <div className="p-4 text-sm text-[var(--negative)]">Tarjeta no disponible.</div>

  if (definition.tab === "resumen") return <TabResumen onNavigate={() => {}} />
  if (definition.tab === "finanzas") return <TabFinanzas initialSubtab={definition.subtab} />
  if (definition.tab === "macro") return <TabMacro initialSubtab={definition.subtab} />
  if (definition.tab === "bcra") return <TabBCRA initialSubtab={definition.subtab} />
  if (definition.tab === "noticias") return <NewsFeed />

  return <div className="p-4 text-sm text-[var(--text-dim)]">Sin visualización.</div>
}
