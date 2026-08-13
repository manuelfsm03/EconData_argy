export type RegisteredFeed = {
  id: string
  url: string
  source: string
}

export const REGISTERED_FEEDS = {
  ambito_economia: { id: "ambito_economia", url: "https://www.ambito.com/rss/economia.xml", source: "Ámbito" },
  ambito_finanzas: { id: "ambito_finanzas", url: "https://www.ambito.com/rss/finanzas.xml", source: "Ámbito Finanzas" },
  infobae: { id: "infobae", url: "https://www.infobae.com/arc/outboundfeeds/rss/", source: "Infobae" },
  cronista: { id: "cronista", url: "https://www.cronista.com/files/rss/news.xml", source: "El Cronista" },
  iprofesional: { id: "iprofesional", url: "https://www.iprofesional.com/rss/finanzas", source: "iProfesional" },
  bae: { id: "bae", url: "https://www.baenegocios.com/feed/", source: "BAE Negocios" },
  lanacion_economia: { id: "lanacion_economia", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/economia/", source: "La Nación" },
  perfil_economia: { id: "perfil_economia", url: "https://www.perfil.com/feed/economia", source: "Perfil" },
  economista: { id: "economista", url: "https://www.eleconomista.com.ar/feed/", source: "El Economista" },
} as const satisfies Record<string, RegisteredFeed>

export type FeedId = keyof typeof REGISTERED_FEEDS

export function getRegisteredFeed(feedId: string): RegisteredFeed | null {
  return REGISTERED_FEEDS[feedId as FeedId] ?? null
}
