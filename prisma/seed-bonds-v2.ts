/**
 * prisma/seed-bonds-v2.ts
 * Seed de bonos soberanos con flujos correctos de bondterminal.com
 *
 * Ejecutar: cd prisma && DATABASE_URL="file:./dev.db" npx ts-node --compiler-options '{"module":"commonjs"}' seed-bonds-v2.ts
 */

import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

interface ScrapedCashflow {
  fecha: string
  cupon_pct: string
  cupon: number
  amort: number
  total: number
  remaining: string
  type: string
}

interface ScrapedBond {
  isin: string
  nombre: string
  ley: string
  cupon_label: string
  vencimiento: string
  cashflows: ScrapedCashflow[]
}

async function main() {
  const dataPath = path.join(__dirname, "bond-cashflows-scraped.json")
  const raw = fs.readFileSync(dataPath, "utf-8")
  const data = JSON.parse(raw)
  const bonds: Record<string, ScrapedBond> = data.bonds

  for (const [ticker, bond] of Object.entries(bonds)) {
    console.log(`\n=== ${ticker} (${bond.isin}) ===`)

    // Parse cupon from label
    const cuponMatch = bond.cupon_label.match(/([\d.]+)/)
    const cupon = cuponMatch ? parseFloat(cuponMatch[1]) : 0

    // Upsert bond
    const existing = await prisma.sovereignBond.findUnique({ where: { ticker } })

    const bondData = {
      ticker,
      nombre: `${bond.nombre} | ISIN: ${bond.isin}`,
      moneda: "USD",
      ley: bond.ley === "NY" ? "NY" : "local",
      cupon,
      amortizacion: "amortizing",
      vencimiento: new Date(bond.vencimiento),
    }

    let bondRecord
    if (existing) {
      bondRecord = await prisma.sovereignBond.update({
        where: { ticker },
        data: {
          nombre: bondData.nombre,
          cupon: bondData.cupon,
          vencimiento: bondData.vencimiento,
        },
      })
      console.log(`  Updated existing bond`)
    } else {
      bondRecord = await prisma.sovereignBond.create({ data: bondData })
      console.log(`  Created new bond`)
    }

    // Delete old cashflows
    const deleted = await prisma.bondCashflow.deleteMany({
      where: { bondId: bondRecord.id },
    })
    console.log(`  Deleted ${deleted.count} old cashflows`)

    // Insert new cashflows from scraped data
    const cashflowData = bond.cashflows.map((cf) => ({
      bondId: bondRecord.id,
      fechaPago: new Date(cf.fecha),
      cupon: cf.cupon,
      amortizacion: cf.amort,
      flujoTotal: cf.total,
    }))

    const created = await prisma.bondCashflow.createMany({ data: cashflowData })
    console.log(`  Inserted ${created.count} cashflows (source: bondterminal.com)`)
    console.log(`  First: ${bond.cashflows[0]?.fecha} | Last: ${bond.cashflows[bond.cashflows.length - 1]?.fecha}`)
  }

  // Verify
  console.log("\n=== VERIFICATION ===")
  const allBonds = await prisma.sovereignBond.findMany({
    include: { cashflows: { select: { id: true } } },
    orderBy: { vencimiento: "asc" },
  })
  for (const b of allBonds) {
    console.log(`  ${b.ticker}: ${b.cashflows.length} cashflows, vto ${b.vencimiento.toISOString().split("T")[0]}`)
  }
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
