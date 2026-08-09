import { BaseScraper, ScrapeResult } from "./base"
import { prisma } from "@/server/db/prisma"
import { todayUTC } from "@/lib/dates"

interface DolarAPIResponse {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

interface BluelyticsResponse {
  oficial: { value_avg: number; value_sell: number; value_buy: number }
  blue: { value_avg: number; value_sell: number; value_buy: number }
  last_update: string
}

export class DolarAPIScraper extends BaseScraper {
  constructor() {
    super("dolarapi")
  }

  async scrape(): Promise<ScrapeResult> {
    const today = todayUTC()
    
    const rates: Record<string, { compra: number | null; venta: number | null }> = {
      blue: { compra: null, venta: null },
      oficial: { compra: null, venta: null },
      mepLibre: { compra: null, venta: null },
      cclLibre: { compra: null, venta: null },
      mayorista: { compra: null, venta: null },
      cripto: { compra: null, venta: null },
      solidario: { compra: null, venta: null },
    }

    try {
      // Primary source: dolarapi.com
      const response = await fetch("https://dolarapi.com/v1/dolares", {
        headers: { "User-Agent": "PanelDeControl/1.0" },
      })

      if (!response.ok) {
        throw new Error(`DolarAPI returned ${response.status}`)
      }

      const data: DolarAPIResponse[] = await response.json()

      for (const item of data) {
        switch (item.casa) {
          case "blue":
            rates.blue = { compra: item.compra, venta: item.venta }
            break
          case "oficial":
            rates.oficial = { compra: item.compra, venta: item.venta }
            break
          case "bolsa":
            rates.mepLibre = { compra: item.compra, venta: item.venta }
            break
          case "contadoconliqui":
            rates.cclLibre = { compra: item.compra, venta: item.venta }
            break
          case "mayorista":
            rates.mayorista = { compra: item.compra, venta: item.venta }
            break
          case "cripto":
            rates.cripto = { compra: item.compra, venta: item.venta }
            break
          case "tarjeta":
            rates.solidario = { compra: item.compra, venta: item.venta }
            break
        }
      }

      // Save to database (using venta as the main value)
      await prisma.exchangeRate.upsert({
        where: { date: today },
        update: {
          blue: rates.blue.venta,
          oficial: rates.oficial.venta,
          mepLibre: rates.mepLibre.venta,
          cclLibre: rates.cclLibre.venta,
          mayorista: rates.mayorista.venta,
          cripto: rates.cripto.venta,
          solidario: rates.solidario.venta,
        },
        create: {
          date: today,
          blue: rates.blue.venta,
          oficial: rates.oficial.venta,
          mepLibre: rates.mepLibre.venta,
          cclLibre: rates.cclLibre.venta,
          mayorista: rates.mayorista.venta,
          cripto: rates.cripto.venta,
          solidario: rates.solidario.venta,
        },
      })

      const summary = Object.entries(rates)
        .filter(([, v]) => v.venta)
        .map(([k, v]) => `${k}: $${v.venta}`)
        .join(", ")

      return {
        success: true,
        recordsAdded: 1,
        message: summary,
      }
    } catch (error) {
      // Fallback to Bluelytics if dolarapi fails
      try {
        const response = await fetch("https://api.bluelytics.com.ar/v2/latest")
        if (response.ok) {
          const data: BluelyticsResponse = await response.json()
          
          await prisma.exchangeRate.upsert({
            where: { date: today },
            update: {
              blue: data.blue.value_sell,
              oficial: data.oficial.value_sell,
            },
            create: {
              date: today,
              blue: data.blue.value_sell,
              oficial: data.oficial.value_sell,
            },
          })

          return {
            success: true,
            recordsAdded: 1,
            message: `Fallback: Blue: $${data.blue.value_sell}, Oficial: $${data.oficial.value_sell}`,
          }
        }
      } catch {
        // Both failed
      }

      throw error
    }
  }
}

// Standalone function for CLI/tool use
export async function fetchDolarRates(): Promise<{
  rates: Record<string, { compra: number; venta: number; variacion?: number }>
  timestamp: string
}> {
  const response = await fetch("https://dolarapi.com/v1/dolares")
  if (!response.ok) throw new Error("Failed to fetch rates")

  const data: DolarAPIResponse[] = await response.json()
  const rates: Record<string, { compra: number; venta: number }> = {}

  const nameMap: Record<string, string> = {
    blue: "Blue",
    oficial: "Oficial",
    bolsa: "MEP",
    contadoconliqui: "CCL",
    mayorista: "Mayorista",
    cripto: "Cripto",
    tarjeta: "Tarjeta",
  }

  for (const item of data) {
    const name = nameMap[item.casa] || item.nombre
    rates[name] = { compra: item.compra, venta: item.venta }
  }

  return {
    rates,
    timestamp: new Date().toISOString(),
  }
}
