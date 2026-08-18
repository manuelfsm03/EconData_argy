import { BaseScraper } from "./base"
import { DolarAPIScraper } from "./dolarapi"
import { CriptoYaScraper } from "./criptoya"
import { RSSScraper } from "./rss"
import { BondPriceScraper } from "./bond-prices"

export type ScraperName = "dolarapi" | "criptoya" | "rss" | "bond-prices" | "all"

export function getScraper(name: ScraperName): BaseScraper | null {
  switch (name) {
    case "dolarapi":
      return new DolarAPIScraper()
    case "criptoya":
      return new CriptoYaScraper()
    case "rss":
      return new RSSScraper()
    case "bond-prices":
      return new BondPriceScraper()
    default:
      return null
  }
}

export async function runAllScrapers() {
  const scraperNames: ScraperName[] = ["dolarapi", "criptoya", "rss", "bond-prices"]
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
