import { BaseScraper, ScrapeResult } from "./base"
import { prisma } from "@/lib/prisma"
import { todayUTC } from "@/lib/dates"

export class RavaScraper extends BaseScraper {
  constructor() {
    super("rava")
  }

  async scrape(): Promise<ScrapeResult> {
    if (!this.page) throw new Error("Browser not initialized")

    let recordsAdded = 0
    const today = todayUTC()

    try {
      // Navigate to Rava's dollar page
      await this.page.goto("https://www.rava.com/cotizaciones/dolares", {
        waitUntil: "networkidle",
        timeout: 30000,
      })

      await this.page.waitForTimeout(3000)

      const rates: Record<string, number | null> = {
        blue: null,
        cclLibre: null,
        mepLibre: null,
        oficial: null,
        mayorista: null,
      }

      // Extract rates from Rava's table structure
      // The exact selectors need to be verified against the actual site
      const rows = await this.page.$$("table tbody tr, .cotizacion-row, [data-cotizacion]")

      for (const row of rows) {
        try {
          const text = await row.textContent()
          if (!text) continue

          const textLower = text.toLowerCase()

          // Find the price value in the row
          const priceMatch = text.match(/\$?\s*([\d.,]+)/)
          if (!priceMatch) continue

          const price = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."))
          if (isNaN(price) || price <= 0) continue

          if (textLower.includes("blue")) {
            rates.blue = price
          } else if (textLower.includes("ccl") || textLower.includes("contado con liqui")) {
            rates.cclLibre = price
          } else if (textLower.includes("mep") || textLower.includes("bolsa")) {
            rates.mepLibre = price
          } else if (textLower.includes("oficial") && !textLower.includes("mayorista")) {
            rates.oficial = price
          } else if (textLower.includes("mayorista")) {
            rates.mayorista = price
          }
        } catch {
          continue
        }
      }

      // Try alternative API approach if scraping failed
      if (!rates.blue && !rates.cclLibre) {
        try {
          // Rava sometimes has an internal API
          const apiResponse = await this.page.evaluate(async () => {
            const res = await fetch("/api/cotizaciones/dolares")
            return res.ok ? res.json() : null
          })

          if (apiResponse && Array.isArray(apiResponse)) {
            for (const item of apiResponse) {
              const nombre = (item.nombre || item.name || "").toLowerCase()
              const value = parseFloat(item.venta || item.valor || item.value || 0)

              if (value > 0) {
                if (nombre.includes("blue")) rates.blue = value
                else if (nombre.includes("ccl")) rates.cclLibre = value
                else if (nombre.includes("mep")) rates.mepLibre = value
                else if (nombre.includes("oficial")) rates.oficial = value
                else if (nombre.includes("mayorista")) rates.mayorista = value
              }
            }
          }
        } catch {
          console.log("API fallback failed")
        }
      }

      // Save to database
      if (rates.blue || rates.cclLibre || rates.mepLibre || rates.oficial) {
        await prisma.exchangeRate.upsert({
          where: { date: today },
          update: {
            ...(rates.blue && { blue: rates.blue }),
            ...(rates.cclLibre && { cclLibre: rates.cclLibre }),
            ...(rates.mepLibre && { mepLibre: rates.mepLibre }),
            ...(rates.oficial && { oficial: rates.oficial }),
            ...(rates.mayorista && { mayorista: rates.mayorista }),
          },
          create: {
            date: today,
            blue: rates.blue,
            cclLibre: rates.cclLibre,
            mepLibre: rates.mepLibre,
            oficial: rates.oficial,
            mayorista: rates.mayorista,
          },
        })
        recordsAdded = 1
      }

      // Now try to scrape Merval
      await this.scrapemerval()

      return {
        success: true,
        recordsAdded,
        message: `Rates scraped: Blue=${rates.blue}, CCL=${rates.cclLibre}, MEP=${rates.mepLibre}`,
      }
    } catch (error) {
      throw error
    }
  }

  private async scrapemerval(): Promise<void> {
    if (!this.page) return

    try {
      await this.page.goto("https://www.rava.com/cotizaciones/indices", {
        waitUntil: "networkidle",
        timeout: 30000,
      })

      await this.page.waitForTimeout(2000)

      const today = todayUTC()

      // Look for Merval value
      const content = await this.page.content()
      const mervalMatch = content.match(/merval[^0-9]*([0-9.,]+)/i)

      if (mervalMatch) {
        const value = parseFloat(mervalMatch[1].replace(/\./g, "").replace(",", "."))
        if (!isNaN(value) && value > 0) {
          await prisma.mervalIndex.upsert({
            where: { date: today },
            update: { value },
            create: { date: today, value },
          })
        }
      }
    } catch (error) {
      console.error("Error scraping Merval:", error)
    }
  }
}
