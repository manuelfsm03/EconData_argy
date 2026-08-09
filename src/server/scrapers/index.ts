import { BaseScraper } from "./base"
import { DolarAPIScraper } from "./dolarapi"
import { CriptoYaScraper } from "./criptoya"
import { BCRAScraper } from "./bcra"
import { RSSScraper } from "./rss"

export type ScraperName = "dolarapi" | "criptoya" | "bcra" | "rss" | "all"

export function getScraper(name: ScraperName): BaseScraper | null {
  switch (name) {
    case "dolarapi":
      return new DolarAPIScraper()
    case "criptoya":
      return new CriptoYaScraper()
    case "bcra":
      return new BCRAScraper()
    case "rss":
      return new RSSScraper()
    default:
      return null
  }
}

export async function runAllScrapers() {
  const scraperNames: ScraperName[] = ["dolarapi", "criptoya", "bcra", "rss"]
  const results: Record<string, unknown> = {}

  for (const name of scraperNames) {
    const scraper = getScraper(name)
    if (scraper) {
      try {
        results[name] = await scraper.run()
      } catch (error) {
        results[name] = {
          success: false,
          recordsAdded: 0,
          message: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }
  }

  return results
}

export { BaseScraper }
export { fetchDolarRates } from "./dolarapi"
