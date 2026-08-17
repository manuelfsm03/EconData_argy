import { NextResponse } from "next/server"
import { prisma } from "@/server/db/prisma"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const report = await prisma.report.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { username: true, displayName: true } },
    },
  })
  if (!report) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Informe no encontrado", retryable: false } }, { status: 404 })
  }
  return NextResponse.json({ data: report })
}
