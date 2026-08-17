/**
 * /api/informes — informes de coyuntura escritos por el equipo.
 * GET: público, lista los más recientes primero.
 * POST: requiere sesión + canPublish=true (ver require-publisher.ts).
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"
import { requirePublisher } from "@/server/auth/require-publisher"

export async function GET() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      author: { select: { username: true, displayName: true } },
    },
  })
  return NextResponse.json({ data: reports })
}

export async function POST(request: NextRequest) {
  const { profile, blocked } = await requirePublisher()
  if (blocked) return blocked

  const body = await request.json().catch(() => null)
  const title = typeof body?.title === "string" ? body.title.trim() : ""
  const contenido = typeof body?.body === "string" ? body.body.trim() : ""

  if (!title || title.length > 200 || !contenido || contenido.length > 20_000) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Falta título/contenido, o exceden el largo máximo", retryable: false } },
      { status: 400 },
    )
  }

  const report = await prisma.report.create({
    data: { title, body: contenido, authorId: profile!.id },
    select: { id: true, title: true, createdAt: true },
  })
  return NextResponse.json({ data: report }, { status: 201 })
}
