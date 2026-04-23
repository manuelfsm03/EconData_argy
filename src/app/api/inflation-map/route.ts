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
  } catch (error) {
    console.error("[inflation-map]", error)
    return new NextResponse(
      `<html><body style="background:#000; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh;">
        <div style="text-align:center; font-family:monospace;">
          <h3>Error cargando mapa de inflación</h3>
          <p>Tipo: ${type}</p>
        </div>
      </body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    )
  }
}
