import { BaseScraper, ScrapeResult } from "./base"
import { prisma } from "@/server/db/prisma"
import { todayUTC } from "@/lib/dates"

export class FinanzasArgyScraper extends BaseScraper {
  constructor() {
    super("finanzasargy")
  }

  async scrape(): Promise<ScrapeResult> {
    if (!this.page) throw new Error("Browser not initialized")

    let recordsAdded = 0
    const today = todayUTC()

    try {
      // Navigate to finanzasargy - a popular Argentine financial site
      await this.page.goto("https://www.finanzasargy.com/", {
        waitUntil: "networkidle",
        timeout: 30000,
      })

      // Wait for content to load
      await this.page.waitForTimeout(2000)

      // Try to extract dollar values from the page
      // Note: The actual selectors will need to be adjusted based on the site's structure
      const rates: Record<string, number | null> = {
        blue: null,
        cclLibre: null,
        mepLibre: null,
      }

      // Extract Blue dollar
      try {
        const blueElement = await this.page.$('[data-type="blue"], .dolar-blue, #blue-value')
        if (blueElement) {
          const text = await blueElement.textContent()
          if (text) {
            const value = parseFloat(text.replace(/[^0-9.,]/g, "").replace(",", "."))
            if (!isNaN(value)) rates.blue = value
          }
        }
      } catch {
        console.log("Could not find blue dollar element")
      }

      // Extract CCL
      try {
        const cclElement = await this.page.$('[data-type="ccl"], .dolar-ccl, #ccl-value')
        if (cclElement) {
          const text = await cclElement.textContent()
          if (text) {
            const value = parseFloat(text.replace(/[^0-9.,]/g, "").replace(",", "."))
            if (!isNaN(value)) rates.cclLibre = value
          }
        }
      } catch {
        console.log("Could not find CCL element")
      }

      // Extract MEP
      try {
        const mepElement = await this.page.$('[data-type="mep"], .dolar-mep, #mep-value')
        if (mepElement) {
          const text = await mepElement.textContent()
          if (text) {
            const value = parseFloat(text.replace(/[^0-9.,]/g, "").replace(",", "."))
            if (!isNaN(value)) rates.mepLibre = value
          }
        }
      } catch {
        console.log("Could not find MEP element")
      }

      // Alternative: Try to get data from API if available
      if (!rates.blue && !rates.cclLibre && !rates.mepLibre) {
        // Try DolarHoy API as fallback
        try {
          const response = await fetch("https://www.dolarsi.com/api/api.php?type=valoresprincipales")
          if (response.ok) {
            const data = await response.json()
            for (const item of data) {
              const nombre = item.casa?.nombre?.toLowerCase() || ""
              const venta = parseFloat(item.casa?.venta?.replace(",", ".") || "0")

              if (nombre.includes("blue") && venta > 0) {
                rates.blue = venta
              } else if (nombre.includes("contado con liqui") && venta > 0) {
                rates.cclLibre = venta
              } else if (nombre.includes("bolsa") && venta > 0) {
                rates.mepLibre = venta
              }
            }
          }
        } catch (error) {
          console.log("Fallback API failed:", error)
        }
      }

      // Save to database
      if (rates.blue || rates.cclLibre || rates.mepLibre) {
        await prisma.exchangeRate.upsert({
          where: { date: today },
          update: {
            ...(rates.blue && { blue: rates.blue }),
            ...(rates.cclLibre && { cclLibre: rates.cclLibre }),
            ...(rates.mepLibre && { mepLibre: rates.mepLibre }),
          },
          create: {
            date: today,
            blue: rates.blue,
            cclLibre: rates.cclLibre,
            mepLibre: rates.mepLibre,
          },
        })
        recordsAdded = 1
      }

      return {
        success: true,
        recordsAdded,
        message: `Blue: ${rates.blue}, CCL: ${rates.cclLibre}, MEP: ${rates.mepLibre}`,
      }
    } catch (error) {
      throw error
    }
  }
}
