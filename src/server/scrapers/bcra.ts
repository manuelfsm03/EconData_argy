import { BaseScraper, ScrapeResult } from "./base"
import { prisma } from "@/server/db/prisma"
import { todayUTC } from "@/lib/dates"

export class BCRAScraper extends BaseScraper {
  constructor() {
    super("bcra")
  }

  async scrape(): Promise<ScrapeResult> {
    let recordsAdded = 0
    const today = todayUTC()
    const messages: string[] = []

    try {
      // Scrape the BCRA website for monetary data
      if (!this.page) {
        throw new Error("Browser page not initialized")
      }

      await this.page.goto("https://www.bcra.gob.ar/estadisticas-indicadores/", {
        waitUntil: "networkidle",
        timeout: 30000,
      })

      await this.page.waitForTimeout(2000)

      // Parse monetary data from the BCRA website
      const monetaryData = await this.page.evaluate(() => {
        const data: Record<string, { value: number; date: string }> = {}

        // Find all rows in tables
        const rows = document.querySelectorAll("table tr, .table tr, .datatable tr")

        rows.forEach((row) => {
          const cells = row.querySelectorAll("td")
          if (cells.length >= 3) {
            const indicator = cells[0]?.textContent?.toLowerCase() || ""
            const dateStr = cells[1]?.textContent?.trim() || ""
            const valueStr = cells[2]?.textContent?.trim() || ""

            // Parse number: remove dots (thousands), replace comma with dot (decimal)
            const cleanedValue = valueStr.replace(/\./g, "").replace(",", ".").trim()
            const value = parseFloat(cleanedValue)

            // Parse date: DD/MM/YYYY to YYYY-MM-DD
            let date: string | null = null
            const dateParts = dateStr.split("/")
            if (dateParts.length === 3) {
              date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`
            }

            if (!isNaN(value) && date) {
              // Map indicators to our database fields
              if (indicator.includes("reservas internacionales")) {
                data.reservas = { value, date }
              } else if (indicator.includes("base monetaria") && indicator.includes("total")) {
                data.baseMonetaria = { value, date }
              } else if (indicator.includes("circulación monetaria") && !indicator.includes("billetes")) {
                data.circulacion = { value, date }
              } else if (indicator.includes("préstamos") && indicator.includes("sector privado")) {
                data.prestamosPrivado = { value, date }
              } else if (indicator.includes("tipo de cambio mayorista") || indicator.includes("comunicación a 3500")) {
                data.tcMayorista = { value, date }
              } else if (indicator.includes("tipo de cambio minorista") || indicator.includes("comunicación b 9791")) {
                data.tcMinorista = { value, date }
              } else if (indicator.includes("badlar") && indicator.includes("n.a.") && !indicator.includes("e.a.")) {
                data.badlar = { value: value / 100, date } // Convert percentage to decimal
              } else if (indicator.includes("tm20") && indicator.includes("n.a.") && !indicator.includes("e.a.")) {
                data.tm20 = { value: value / 100, date }
              } else if (indicator.includes("depósitos a 30 días") && indicator.includes("n.a.") && !indicator.includes("e.a.")) {
                data.depositos30d = { value: value / 100, date }
              } else if (indicator.includes("cer") && indicator.includes("base")) {
                data.cer = { value, date }
              } else if (indicator.includes("uva") && indicator.includes("base")) {
                data.uva = { value, date }
              } else if (indicator.includes("uvi") && indicator.includes("base")) {
                data.uvi = { value, date }
              }
            }
          }
        })

        return data
      })

      console.log("Scraped monetary data:", monetaryData)

      // Save to bcra_monetary_data table
      if (Object.keys(monetaryData).length > 0) {
        // Get the date from the data or use today
        const dataDate = monetaryData.reservas?.date ||
                        monetaryData.baseMonetaria?.date ||
                        today.toISOString().split("T")[0]

        const dbDate = new Date(dataDate)

        await prisma.bCRAMonetaryData.upsert({
          where: { date: dbDate },
          update: {
            ...(monetaryData.reservas && { reservas: monetaryData.reservas.value }),
            ...(monetaryData.baseMonetaria && { baseMonetaria: monetaryData.baseMonetaria.value }),
            ...(monetaryData.circulacion && { circulacion: monetaryData.circulacion.value }),
            ...(monetaryData.prestamosPrivado && { prestamosPrivado: monetaryData.prestamosPrivado.value }),
            ...(monetaryData.tcMayorista && { tcMayorista: monetaryData.tcMayorista.value }),
            ...(monetaryData.tcMinorista && { tcMinorista: monetaryData.tcMinorista.value }),
            ...(monetaryData.badlar && { badlar: monetaryData.badlar.value }),
            ...(monetaryData.tm20 && { tm20: monetaryData.tm20.value }),
            ...(monetaryData.depositos30d && { depositos30d: monetaryData.depositos30d.value }),
            ...(monetaryData.cer && { cer: monetaryData.cer.value }),
            ...(monetaryData.uva && { uva: monetaryData.uva.value }),
            ...(monetaryData.uvi && { uvi: monetaryData.uvi.value }),
          },
          create: {
            date: dbDate,
            reservas: monetaryData.reservas?.value ?? null,
            baseMonetaria: monetaryData.baseMonetaria?.value ?? null,
            circulacion: monetaryData.circulacion?.value ?? null,
            prestamosPrivado: monetaryData.prestamosPrivado?.value ?? null,
            tcMayorista: monetaryData.tcMayorista?.value ?? null,
            tcMinorista: monetaryData.tcMinorista?.value ?? null,
            badlar: monetaryData.badlar?.value ?? null,
            tm20: monetaryData.tm20?.value ?? null,
            depositos30d: monetaryData.depositos30d?.value ?? null,
            cer: monetaryData.cer?.value ?? null,
            uva: monetaryData.uva?.value ?? null,
            uvi: monetaryData.uvi?.value ?? null,
          },
        })
        recordsAdded++
        messages.push(`BCRA Monetary Data: ${Object.keys(monetaryData).join(", ")}`)
      } else {
        messages.push("No monetary data found on page")
      }

      // Also update exchange rates from the scraped data
      if (monetaryData.tcMayorista || monetaryData.tcMinorista) {
        await prisma.exchangeRate.upsert({
          where: { date: today },
          update: {
            ...(monetaryData.tcMayorista && { mayorista: monetaryData.tcMayorista.value }),
            ...(monetaryData.tcMinorista && { oficial: monetaryData.tcMinorista.value }),
          },
          create: {
            date: today,
            mayorista: monetaryData.tcMayorista?.value ?? null,
            oficial: monetaryData.tcMinorista?.value ?? null,
          },
        })
        recordsAdded++
        messages.push("Exchange rates updated")
      }

      // Update badlar rate
      if (monetaryData.badlar) {
        await prisma.badlarRate.upsert({
          where: { date: today },
          update: { rate: monetaryData.badlar.value },
          create: { date: today, rate: monetaryData.badlar.value },
        })
        recordsAdded++
        messages.push("Badlar rate updated")
      }

      return {
        success: true,
        recordsAdded,
        message: messages.join(" | ") || "No data found",
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return {
        success: false,
        recordsAdded,
        message: `Error: ${errorMessage}`,
      }
    }
  }
}
