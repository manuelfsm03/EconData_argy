import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import * as path from "path"

const prisma = new PrismaClient()

async function seedFromExcel() {
  const filePath = process.argv[2] || path.join(__dirname, "../../Downloads/PANEL DE CONTROL  15.5.2023 (1).xlsm")

  console.log("Reading Excel file:", filePath)

  const workbook = XLSX.readFile(filePath)

  // Seed Exchange Rates from "TC desde 2020" sheet
  console.log("\nSeeding Exchange Rates...")
  await seedExchangeRates(workbook)

  // Seed Inflation data
  console.log("\nSeeding Inflation data...")
  await seedInflation(workbook)

  // Seed Rofex data
  console.log("\nSeeding Rofex data...")
  await seedRofex(workbook)

  console.log("\nSeeding complete!")
}

async function seedExchangeRates(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets["TC desde 2020"]
  if (!sheet) {
    console.log("Sheet 'TC desde 2020' not found")
    return
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown[][]
  let count = 0

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    if (!row || !row[0]) continue

    try {
      const date = excelDateToJS(row[0] as number)
      if (!date || isNaN(date.getTime())) continue

      await prisma.exchangeRate.upsert({
        where: { date },
        update: {
          blue: parseFloat(String(row[1])) || null,
          cclLibre: parseFloat(String(row[2])) || null,
          cclControlado: parseFloat(String(row[3])) || null,
          mepControlado: parseFloat(String(row[4])) || null,
          mepLibre: parseFloat(String(row[5])) || null,
          oficial: parseFloat(String(row[6])) || null,
          mayorista: parseFloat(String(row[7])) || null,
          a3500: parseFloat(String(row[8])) || null,
          solidario: parseFloat(String(row[9])) || null,
        },
        create: {
          date,
          blue: parseFloat(String(row[1])) || null,
          cclLibre: parseFloat(String(row[2])) || null,
          cclControlado: parseFloat(String(row[3])) || null,
          mepControlado: parseFloat(String(row[4])) || null,
          mepLibre: parseFloat(String(row[5])) || null,
          oficial: parseFloat(String(row[6])) || null,
          mayorista: parseFloat(String(row[7])) || null,
          a3500: parseFloat(String(row[8])) || null,
          solidario: parseFloat(String(row[9])) || null,
        },
      })
      count++

      if (count % 100 === 0) {
        console.log(`  Processed ${count} exchange rate records...`)
      }
    } catch (error) {
      // Skip invalid rows
    }
  }

  console.log(`  Total exchange rates seeded: ${count}`)
}

async function seedInflation(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets["Inflación"]
  if (!sheet) {
    console.log("Sheet 'Inflación' not found")
    return
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown[][]
  let count = 0

  // Skip header rows
  for (let i = 4; i < data.length; i++) {
    const row = data[i]
    if (!row || !row[0]) continue

    try {
      const date = excelDateToJS(row[0] as number)
      if (!date || isNaN(date.getTime())) continue

      await prisma.inflation.upsert({
        where: { date },
        update: {
          interannual: parseFloat(String(row[2])) || null,
          yearToDate: parseFloat(String(row[3])) || null,
          monthly: parseFloat(String(row[4])) || null,
          accumulated: parseFloat(String(row[5])) || null,
        },
        create: {
          date,
          interannual: parseFloat(String(row[2])) || null,
          yearToDate: parseFloat(String(row[3])) || null,
          monthly: parseFloat(String(row[4])) || null,
          accumulated: parseFloat(String(row[5])) || null,
        },
      })
      count++
    } catch (error) {
      // Skip invalid rows
    }
  }

  console.log(`  Total inflation records seeded: ${count}`)
}

async function seedRofex(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets["Rofex"]
  if (!sheet) {
    console.log("Sheet 'Rofex' not found")
    return
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown[][]
  let count = 0

  // Skip header rows
  for (let i = 8; i < data.length; i++) {
    const row = data[i]
    if (!row || !row[1] || !row[2]) continue

    try {
      const date = excelDateToJS(row[1] as number)
      const maturity = excelDateToJS(row[3] as number)
      if (!date || isNaN(date.getTime()) || !maturity || isNaN(maturity.getTime())) continue

      const position = String(row[2])
      if (!position || position === "Spot A3500") continue

      await prisma.rofexFuture.upsert({
        where: {
          date_position: { date, position },
        },
        update: {
          maturity,
          maturityLabel: String(row[4]) || null,
          price: parseFloat(String(row[5])) || null,
          devaluation: parseFloat(String(row[6])) || null,
          monthlyDevaluation: parseFloat(String(row[7])) || null,
          tna: parseFloat(String(row[8])) || null,
          cft: parseFloat(String(row[9])) || null,
        },
        create: {
          date,
          position,
          maturity,
          maturityLabel: String(row[4]) || null,
          price: parseFloat(String(row[5])) || null,
          devaluation: parseFloat(String(row[6])) || null,
          monthlyDevaluation: parseFloat(String(row[7])) || null,
          tna: parseFloat(String(row[8])) || null,
          cft: parseFloat(String(row[9])) || null,
        },
      })
      count++
    } catch (error) {
      // Skip invalid rows
    }
  }

  console.log(`  Total Rofex records seeded: ${count}`)
}

function excelDateToJS(excelDate: number): Date | null {
  if (typeof excelDate !== "number" || isNaN(excelDate)) return null

  // Excel dates are days since Dec 30, 1899
  const date = new Date((excelDate - 25569) * 86400 * 1000)
  date.setHours(0, 0, 0, 0)
  return date
}

seedFromExcel()
  .catch((error) => {
    console.error("Error seeding:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
