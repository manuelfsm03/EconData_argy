import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? "global"

  try {
    const filePath =
      type === "argentina"
        ? join(process.cwd(), "public/inflation_map.html")
        : join(process.cwd(), "public/inflation_map_global.html")

    const fileContent = readFileSync(filePath, "utf-8")

    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return new NextResponse(
      `<html><body style="background:#060606;color:#555;display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;">
        <div style="text-align:center;">
          <div style="font-size:11px;letter-spacing:2px;">MAPA DE INFLACIÓN — NO DISPONIBLE</div>
          <div style="font-size:9px;margin-top:8px;color:#333;">Tipo: ${type}</div>
        </div>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }
}
