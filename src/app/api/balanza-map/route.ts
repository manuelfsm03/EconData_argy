import { NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public/balanza_socios_map.html")
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
          <div style="font-size:11px;letter-spacing:2px;">MAPA DE SOCIOS COMERCIALES — NO DISPONIBLE</div>
        </div>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }
}
