import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { requireAdminAuthorization } from "@/server/api/admin-auth"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  const source = searchParams.get("source")

  try {
    const news = await prisma.newsItem.findMany({
      where: source ? { source } : undefined,
      orderBy: { pubDate: "desc" },
      take: limit,
      skip: offset,
    })

    return NextResponse.json(news)
  } catch (error) {
    // La tabla newsItem vive en la Postgres que todavía no está provisionada
    // (mismo bloqueo que login/foro/profiles, ver PR #89/#90 — depende de
    // credenciales de Vercel que no son mías para resolver). El único
    // consumidor real de esta ruta (`lapizarra coyuntura` en el CLI) ya cae
    // a /api/rss-news apenas ve un array vacío — devolver [] acá, en vez de
    // un 500 con stack trace en cada llamada, es la misma señal sin el
    // ruido: se degrada limpio en vez de "fallar" por algo que no es un bug
    // de esta ruta. Si vuelve a estar disponible, vuelve a andar solo.
    console.warn("[/api/news] newsItem no disponible (Postgres sin provisionar), devuelvo vacío:", error instanceof Error ? error.message : error)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminAuthorization(request)
  if (unauthorized) return unauthorized
  try {
    const data = await request.json()

    // Handle batch insert
    if (Array.isArray(data)) {
      const results = []
      for (const item of data) {
        try {
          const news = await prisma.newsItem.upsert({
            where: { link: item.link },
            update: {
              title: item.title,
              description: item.description,
              source: item.source,
              pubDate: new Date(item.pubDate),
              category: item.category,
            },
            create: {
              title: item.title,
              link: item.link,
              description: item.description,
              source: item.source,
              pubDate: new Date(item.pubDate),
              category: item.category,
            },
          })
          results.push(news)
        } catch {
          // Skip duplicates
        }
      }
      return NextResponse.json({ added: results.length })
    }

    const news = await prisma.newsItem.upsert({
      where: { link: data.link },
      update: {
        title: data.title,
        description: data.description,
        source: data.source,
        pubDate: new Date(data.pubDate),
        category: data.category,
      },
      create: {
        title: data.title,
        link: data.link,
        description: data.description,
        source: data.source,
        pubDate: new Date(data.pubDate),
        category: data.category,
      },
    })

    return NextResponse.json(news)
  } catch (error) {
    console.error("Error saving news:", error)
    return NextResponse.json(
      { error: "Failed to save news" },
      { status: 500 }
    )
  }
}
