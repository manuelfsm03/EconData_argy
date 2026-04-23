/**
 * POST /api/pivot/suggest
 * Endpoint interno para sugerencias de análisis en PIVOT.
 * Sin rate limit de usuario — es una función interna del dashboard.
 * Llama directamente al LLM con el catálogo disponible.
 */

import { NextRequest, NextResponse } from "next/server"
import { SERIES_CATALOG } from "../route"

export const runtime    = "nodejs"
export const maxDuration = 15

export async function POST(req: NextRequest) {
  const body = await req.json() as { selected_ids?: string[] }
  const selectedIds = body.selected_ids ?? []

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 503 })
  }

  const available = SERIES_CATALOG
    .map(s => `${s.id}|${s.label}|${s.unidad}|${s.categoria}`)
    .join("\n")

  const contexto = selectedIds.length > 0
    ? `Series ya seleccionadas por el usuario: ${selectedIds.map(id => SERIES_CATALOG.find(s=>s.id===id)?.label ?? id).join(", ")}.`
    : "El usuario no seleccionó series todavía."

  const prompt = `Sos un analista de datos económicos argentinos. ${contexto}

Series disponibles en el dashboard (formato id|nombre|unidad|categoría):
${available}

Sugerí 3 análisis interesantes. Para cada uno:
- Elegí 2-4 series del listado (usar el id exacto)
- Elegí el tipo de gráfico más adecuado
- Escribí una explicación breve de qué insight económico revela

Respondé ÚNICAMENTE con JSON válido, sin texto extra:
[
  {
    "label": "Nombre del análisis",
    "ids": ["id1", "id2"],
    "tipo": "linea",
    "explicacion": "Qué muestra este cruce y por qué es relevante para Argentina."
  }
]

Tipos válidos: linea, area, barra, scatter, densidad.`

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:     "Sos un asistente de análisis de datos. Respondés siempre con JSON puro, sin markdown ni texto adicional.",
        messages:   [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `LLM error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json() as {
      content: { type: string; text?: string }[]
    }

    const text = data.content
      .filter(b => b.type === "text")
      .map(b => b.text ?? "")
      .join("")
      .trim()
      .replace(/```json|```/g, "")
      .trim()

    let suggestions: unknown[]
    try {
      suggestions = JSON.parse(text)
      if (!Array.isArray(suggestions)) throw new Error("not array")
    } catch {
      return NextResponse.json({ error: "Respuesta no parseable", raw: text }, { status: 502 })
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 3) })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 100) }, { status: 500 })
  }
}
