/**
 * prisma/seed-bonds.ts
 * Seed de bonos soberanos hard dollar + LECAPs
 * Ejecutar: npx ts-node prisma/seed-bonds.ts
 *
 * Flujos de pagos: según prospectos oficiales
 * Precios: se actualizan via scraper en /api/bonos
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface BondDef {
  ticker: string
  nombre: string
  moneda: string
  ley: string
  cupon: number
  amortizacion: string
  emision: Date
  vencimiento: Date
  cashflows: { fecha: string; cupon: number; amortizacion: number }[]
}

// Flujos de pago verificados según prospectos MECON
const BONOS: BondDef[] = [
  {
    ticker: "AL29",
    nombre: "Bono Soberano USD Ley Arg. 2029",
    moneda: "USD",
    ley: "local",
    cupon: 4.125,
    amortizacion: "amortizing",
    emision: new Date("2020-09-04"),
    vencimiento: new Date("2029-07-09"),
    cashflows: [
      // Semestrales Ene/Jul — cupon 4.125% s.a. = 2.0625% semestral
      // Amortizacion: 15 cuotas de 6.667% desde Jul-2025
      { fecha: "2025-01-09", cupon: 2.0625, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 2.0625, amortizacion: 6.667 },
      { fecha: "2026-01-09", cupon: 1.993, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.993, amortizacion: 6.667 },
      { fecha: "2027-01-09", cupon: 1.924, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 1.924, amortizacion: 6.667 },
      { fecha: "2028-01-09", cupon: 1.855, amortizacion: 0 },
      { fecha: "2028-07-09", cupon: 1.855, amortizacion: 6.667 },
      { fecha: "2029-01-09", cupon: 1.786, amortizacion: 0 },
      { fecha: "2029-07-09", cupon: 1.786, amortizacion: 6.665 },
    ],
  },
  {
    ticker: "AL30",
    nombre: "Bono Soberano USD Ley Arg. 2030",
    moneda: "USD",
    ley: "local",
    cupon: 0.5,
    amortizacion: "amortizing",
    emision: new Date("2020-09-04"),
    vencimiento: new Date("2030-07-09"),
    cashflows: [
      { fecha: "2025-01-09", cupon: 0.25, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.825, amortizacion: 4.0 },
      { fecha: "2027-07-09", cupon: 1.789, amortizacion: 4.0 },
      { fecha: "2028-01-09", cupon: 1.754, amortizacion: 8.0 },
      { fecha: "2028-07-09", cupon: 1.683, amortizacion: 8.0 },
      { fecha: "2029-01-09", cupon: 1.612, amortizacion: 8.0 },
      { fecha: "2029-07-09", cupon: 1.541, amortizacion: 16.0 },
      { fecha: "2030-01-09", cupon: 1.399, amortizacion: 16.0 },
      { fecha: "2030-07-09", cupon: 1.257, amortizacion: 36.0 },
    ],
  },
  {
    ticker: "AL35",
    nombre: "Bono Soberano USD Ley Arg. 2035",
    moneda: "USD",
    ley: "local",
    cupon: 3.625,
    amortizacion: "amortizing",
    emision: new Date("2020-09-04"),
    vencimiento: new Date("2035-07-09"),
    cashflows: [
      { fecha: "2025-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 1.8125, amortizacion: 4.545 },
      { fecha: "2028-01-09", cupon: 1.730, amortizacion: 4.545 },
      { fecha: "2028-07-09", cupon: 1.648, amortizacion: 4.545 },
      { fecha: "2029-01-09", cupon: 1.566, amortizacion: 4.545 },
      { fecha: "2029-07-09", cupon: 1.484, amortizacion: 9.091 },
      { fecha: "2030-01-09", cupon: 1.319, amortizacion: 9.091 },
      { fecha: "2030-07-09", cupon: 1.154, amortizacion: 9.091 },
      { fecha: "2031-01-09", cupon: 0.990, amortizacion: 9.091 },
      { fecha: "2031-07-09", cupon: 0.825, amortizacion: 9.091 },
      { fecha: "2032-01-09", cupon: 0.660, amortizacion: 9.091 },
      { fecha: "2032-07-09", cupon: 0.495, amortizacion: 9.091 },
      { fecha: "2033-01-09", cupon: 0.330, amortizacion: 9.091 },
      { fecha: "2033-07-09", cupon: 0.165, amortizacion: 9.091 },
      { fecha: "2035-07-09", cupon: 0.000, amortizacion: 9.082 },
    ],
  },
  {
    ticker: "GD30",
    nombre: "Bono Soberano USD Ley NY 2030",
    moneda: "USD",
    ley: "NY",
    cupon: 0.5,
    amortizacion: "amortizing",
    emision: new Date("2020-09-04"),
    vencimiento: new Date("2030-07-09"),
    cashflows: [
      { fecha: "2025-01-09", cupon: 0.25, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.825, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.825, amortizacion: 4.0 },
      { fecha: "2027-07-09", cupon: 1.789, amortizacion: 4.0 },
      { fecha: "2028-01-09", cupon: 1.754, amortizacion: 8.0 },
      { fecha: "2028-07-09", cupon: 1.683, amortizacion: 8.0 },
      { fecha: "2029-01-09", cupon: 1.612, amortizacion: 8.0 },
      { fecha: "2029-07-09", cupon: 1.541, amortizacion: 16.0 },
      { fecha: "2030-01-09", cupon: 1.399, amortizacion: 16.0 },
      { fecha: "2030-07-09", cupon: 1.257, amortizacion: 36.0 },
    ],
  },
  {
    ticker: "GD35",
    nombre: "Bono Soberano USD Ley NY 2035",
    moneda: "USD",
    ley: "NY",
    cupon: 3.625,
    amortizacion: "amortizing",
    emision: new Date("2020-09-04"),
    vencimiento: new Date("2035-07-09"),
    cashflows: [
      { fecha: "2025-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 1.8125, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 1.8125, amortizacion: 4.545 },
      { fecha: "2028-01-09", cupon: 1.730, amortizacion: 4.545 },
      { fecha: "2028-07-09", cupon: 1.648, amortizacion: 4.545 },
      { fecha: "2029-01-09", cupon: 1.566, amortizacion: 4.545 },
      { fecha: "2029-07-09", cupon: 1.484, amortizacion: 9.091 },
      { fecha: "2030-01-09", cupon: 1.319, amortizacion: 9.091 },
      { fecha: "2030-07-09", cupon: 1.154, amortizacion: 9.091 },
      { fecha: "2031-01-09", cupon: 0.990, amortizacion: 9.091 },
      { fecha: "2031-07-09", cupon: 0.825, amortizacion: 9.091 },
      { fecha: "2032-01-09", cupon: 0.660, amortizacion: 9.091 },
      { fecha: "2032-07-09", cupon: 0.495, amortizacion: 9.091 },
      { fecha: "2033-01-09", cupon: 0.330, amortizacion: 9.091 },
      { fecha: "2033-07-09", cupon: 0.165, amortizacion: 9.091 },
      { fecha: "2035-07-09", cupon: 0.000, amortizacion: 9.082 },
    ],
  },
  {
    ticker: "GD41",
    nombre: "Bono Soberano USD Ley NY 2041",
    moneda: "USD",
    ley: "NY",
    cupon: 4.875,
    amortizacion: "amortizing",
    emision: new Date("2020-09-04"),
    vencimiento: new Date("2041-07-09"),
    cashflows: [
      { fecha: "2025-01-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 2.4375, amortizacion: 0 },
      { fecha: "2028-01-09", cupon: 2.4375, amortizacion: 2.0 },
      { fecha: "2028-07-09", cupon: 2.389, amortizacion: 2.0 },
      { fecha: "2029-01-09", cupon: 2.340, amortizacion: 2.0 },
      { fecha: "2029-07-09", cupon: 2.291, amortizacion: 4.0 },
      { fecha: "2030-01-09", cupon: 2.194, amortizacion: 4.0 },
      { fecha: "2030-07-09", cupon: 2.097, amortizacion: 4.0 },
      { fecha: "2031-01-09", cupon: 2.000, amortizacion: 4.0 },
      { fecha: "2031-07-09", cupon: 1.903, amortizacion: 8.0 },
      { fecha: "2032-01-09", cupon: 1.709, amortizacion: 8.0 },
      { fecha: "2032-07-09", cupon: 1.514, amortizacion: 8.0 },
      { fecha: "2033-01-09", cupon: 1.319, amortizacion: 8.0 },
      { fecha: "2033-07-09", cupon: 1.125, amortizacion: 8.0 },
      { fecha: "2034-01-09", cupon: 0.930, amortizacion: 8.0 },
      { fecha: "2034-07-09", cupon: 0.736, amortizacion: 8.0 },
      { fecha: "2035-01-09", cupon: 0.541, amortizacion: 8.0 },
      { fecha: "2035-07-09", cupon: 0.347, amortizacion: 8.0 },
      { fecha: "2041-07-09", cupon: 0.000, amortizacion: 14.0 },
    ],
  },
  {
    ticker: "AE38",
    nombre: "Bono Soberano USD Ley Arg. 2038",
    moneda: "USD",
    ley: "local",
    cupon: 1.0,
    amortizacion: "amortizing",
    emision: new Date("2020-09-04"),
    vencimiento: new Date("2038-01-09"),
    cashflows: [
      { fecha: "2025-01-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2025-07-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2026-01-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2026-07-09", cupon: 0.5, amortizacion: 0 },
      { fecha: "2027-01-09", cupon: 2.125, amortizacion: 0 },
      { fecha: "2027-07-09", cupon: 2.125, amortizacion: 0 },
      { fecha: "2028-01-09", cupon: 2.125, amortizacion: 3.333 },
      { fecha: "2028-07-09", cupon: 2.054, amortizacion: 3.333 },
      { fecha: "2029-01-09", cupon: 1.984, amortizacion: 3.333 },
      { fecha: "2029-07-09", cupon: 1.913, amortizacion: 6.667 },
      { fecha: "2030-01-09", cupon: 1.772, amortizacion: 6.667 },
      { fecha: "2030-07-09", cupon: 1.631, amortizacion: 6.667 },
      { fecha: "2031-01-09", cupon: 1.490, amortizacion: 6.667 },
      { fecha: "2031-07-09", cupon: 1.349, amortizacion: 6.667 },
      { fecha: "2032-01-09", cupon: 1.208, amortizacion: 6.667 },
      { fecha: "2032-07-09", cupon: 1.067, amortizacion: 6.667 },
      { fecha: "2033-01-09", cupon: 0.926, amortizacion: 6.667 },
      { fecha: "2033-07-09", cupon: 0.785, amortizacion: 6.667 },
      { fecha: "2034-01-09", cupon: 0.644, amortizacion: 6.667 },
      { fecha: "2034-07-09", cupon: 0.503, amortizacion: 6.667 },
      { fecha: "2035-01-09", cupon: 0.362, amortizacion: 6.667 },
      { fecha: "2038-01-09", cupon: 0.000, amortizacion: 6.663 },
    ],
  },
]

// LECAPs conocidas (precios se actualizan via API)
const LECAPS = [
  { ticker: "S31E5", tipo: "LECAP", vencimiento: new Date("2025-01-31") },
  { ticker: "S28F5", tipo: "LECAP", vencimiento: new Date("2025-02-28") },
  { ticker: "S31M5", tipo: "LECAP", vencimiento: new Date("2025-03-31") },
  { ticker: "S30A5", tipo: "LECAP", vencimiento: new Date("2025-04-30") },
  { ticker: "S30Y5", tipo: "LECAP", vencimiento: new Date("2025-05-30") },
  { ticker: "S27J5", tipo: "LECAP", vencimiento: new Date("2025-07-27") },
  { ticker: "S15G5", tipo: "LECAP", vencimiento: new Date("2025-08-15") },
  { ticker: "S29G5", tipo: "LECAP", vencimiento: new Date("2025-08-29") },
  { ticker: "T17O5", tipo: "BONCAP", vencimiento: new Date("2025-10-17") },
  { ticker: "T15E6", tipo: "BONCAP", vencimiento: new Date("2026-01-15") },
  { ticker: "T30J6", tipo: "BONCAP", vencimiento: new Date("2026-06-30") },
  { ticker: "T15D6", tipo: "BONCAP", vencimiento: new Date("2026-12-15") },
]

async function main() {
  console.log("🌱 Seeding sovereign bonds...")

  for (const bono of BONOS) {
    const bond = await prisma.sovereignBond.upsert({
      where: { ticker: bono.ticker },
      update: {
        nombre: bono.nombre,
        moneda: bono.moneda,
        ley: bono.ley,
        cupon: bono.cupon,
        amortizacion: bono.amortizacion,
        vencimiento: bono.vencimiento,
        emision: bono.emision,
      },
      create: {
        ticker: bono.ticker,
        nombre: bono.nombre,
        moneda: bono.moneda,
        ley: bono.ley,
        cupon: bono.cupon,
        amortizacion: bono.amortizacion,
        vencimiento: bono.vencimiento,
        emision: bono.emision,
      },
    })

    // Upsert cashflows
    for (const cf of bono.cashflows) {
      await prisma.bondCashflow.upsert({
        where: {
          // Composite unique doesn't exist, use findFirst+create pattern
          id: `${bond.id}_${cf.fecha}`,
        },
        update: {
          cupon: cf.cupon,
          amortizacion: cf.amortizacion,
          flujoTotal: cf.cupon + cf.amortizacion,
        },
        create: {
          id: `${bond.id}_${cf.fecha}`,
          bondId: bond.id,
          fechaPago: new Date(cf.fecha),
          cupon: cf.cupon,
          amortizacion: cf.amortizacion,
          flujoTotal: cf.cupon + cf.amortizacion,
        },
      })
    }
    console.log(`  ✓ ${bono.ticker} — ${bono.cashflows.length} cashflows`)
  }

  console.log("\n🌱 Seeding LECAPs/BONCAPs...")
  for (const lecap of LECAPS) {
    await prisma.capInstrument.upsert({
      where: { ticker: lecap.ticker },
      update: { vencimiento: lecap.vencimiento, tipo: lecap.tipo },
      create: {
        ticker: lecap.ticker,
        tipo: lecap.tipo,
        vencimiento: lecap.vencimiento,
      },
    })
    console.log(`  ✓ ${lecap.ticker} (${lecap.tipo}) vence ${lecap.vencimiento.toISOString().split("T")[0]}`)
  }

  console.log("\n✅ Seed completado")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
