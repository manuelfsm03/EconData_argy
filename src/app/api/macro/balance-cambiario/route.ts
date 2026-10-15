/**
 * /api/macro/balance-cambiario — Balance cambiario por sector (BCRA)
 *
 * Sirve public/data/balance-cambiario.json generado por
 * scripts/update-balance-cambiario.mjs (GitHub Actions, mensual).
 * Cero llamadas externas en runtime. Si el JSON todavía no se generó
 * (primera corrida del workflow pendiente) responde 503 DATA_NOT_READY.
 *
 * Query: ?categoria=personas_humanas|energia|agro|... filtra conceptos;
 *        ?id=<id de concepto> devuelve un único concepto.
 */

import { NextResponse } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Concepto { id: string; categoria: string | null }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoria = searchParams.get("categoria")
  const id = searchParams.get("id")

  let data
  try {
    data = JSON.parse(readFileSync(join(process.cwd(), "public", "data", "balance-cambiario.json"), "utf8"))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { error: { code: "DATA_NOT_READY", message: "Pendiente primera corrida de scripts/update-balance-cambiario.mjs", retryable: false } },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Error al leer el balance cambiario", retryable: true } },
      { status: 500 },
    )
  }

  const meta = {
    fuente: data.fuente,
    url: data.url,
    unidad: data.unidad,
    cobertura: data.cobertura,
    generado_en: data.generado_en,
    nota: data.nota,
  }
  const conceptos: Concepto[] = data.conceptos ?? []

  if (id) {
    const c = conceptos.find(x => x.id === id)
    if (!c) return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
    return NextResponse.json({ data: c, meta })
  }
  const filtrados = categoria ? conceptos.filter(x => x.categoria === categoria) : conceptos
  return NextResponse.json({ data: filtrados, meta: { ...meta, total: filtrados.length } })
}
