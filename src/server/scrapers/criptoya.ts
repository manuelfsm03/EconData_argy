import { BaseScraper, ScrapeResult } from "./base"
import { prisma } from "@/server/db/prisma"
import { todayUTC } from "@/lib/dates"

interface CriptoYaResponse {
  ask: number
  totalAsk: number
  bid: number
  totalBid: number
  time: number
}

interface CriptoYaExchange {
  [exchange: string]: CriptoYaResponse
}

export class CriptoYaScraper extends BaseScraper {
  constructor() {
    super("criptoya")
  }

  async scrape(): Promise<ScrapeResult> {
    let recordsAdded = 0

    try {
      // CriptoYa has a public API
      const response = await fetch("https://criptoya.com/api/usdt/ars")

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: CriptoYaExchange = await response.json()
      const today = todayUTC()

      // Get average USDT price across exchanges
      const exchanges = Object.entries(data)
      let totalBid = 0
      let count = 0

      for (const [exchange, rates] of exchanges) {
        if (rates.bid && rates.ask) {
          // Save individual exchange rate
          await prisma.cryptoRate.upsert({
            where: {
              date_exchange: {
                date: today,
                exchange,
              },
            },
            update: {
              usdtArs: (rates.bid + rates.ask) / 2,
            },
            create: {
              date: today,
              exchange,
              usdtArs: (rates.bid + rates.ask) / 2,
            },
          })
          recordsAdded++
          totalBid += rates.bid
          count++
        }
      }

      // Update main exchange rate with average cripto rate
      const avgCripto = count > 0 ? totalBid / count : null

      if (avgCripto) {
        await prisma.exchangeRate.upsert({
          where: { date: today },
          update: { cripto: avgCripto },
          create: {
            date: today,
            cripto: avgCripto,
          },
        })
      }

      return {
        success: true,
        recordsAdded,
        message: `Scraped ${count} exchanges, avg USDT: ${avgCripto?.toFixed(2)}`,
      }
    } catch (error) {
      throw error
    }
  }
}
