import { NextResponse } from "next/server"
import { loadImfMacro } from "@/server/domain/imf-macro-data"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const regionParam = new URL(req.url).searchParams.get("region") ?? "todos"
  const result = await loadImfMacro()
  if (result.allFailed && !result.stale) return NextResponse.json({ error: "IMF DataMapper no disponible" }, { status: 503 })
  const data = regionParam === "todos" ? result.data : result.data.filter((item) => item.region === regionParam)
  return NextResponse.json({
    data,
    ...(result.cached ? { cached: true } : result.stale ? { stale: true, stale_since: result.staleSince } : { cached: false, fuente: "IMF DataMapper API — NGDP_RPCH + PCPIPCH (sin key; incluye estimados WEO)" }),
    updated_at: new Date().toISOString(),
  })
}
