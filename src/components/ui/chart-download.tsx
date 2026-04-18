"use client"

import { useRef, useState } from "react"

interface ChartDownloadProps {
  csvData: Record<string, unknown>[]
  filename: string
  chartRef?: React.RefObject<HTMLDivElement | null>
}

async function capturePng(container: HTMLElement, filename: string) {
  // html-to-image captures the actual rendered DOM (CSS styles included)
  // — fixes blank charts when using Recharts SVG serialization approach
  const { toPng } = await import("html-to-image")

  const dataUrl = await toPng(container, {
    backgroundColor: "#060606",
    pixelRatio: window.devicePixelRatio || 2,
    style: { borderRadius: "0" },
  })

  // Draw watermark on top via canvas
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload  = () => resolve()
    img.onerror = reject
    img.src = dataUrl
  })

  const W = img.width
  const H = img.height

  const canvas = document.createElement("canvas")
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!

  ctx.drawImage(img, 0, 0)

  // Diagonal watermark (very subtle)
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 6)
  ctx.font = `bold ${Math.round(W / 18)}px monospace`
  ctx.fillStyle = "rgba(255,160,40,0.06)"
  ctx.textAlign  = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("lapizarra.ar", 0, 0)
  ctx.restore()

  // Corner watermark
  ctx.font = `${Math.round(W / 70)}px monospace`
  ctx.fillStyle = "rgba(255,160,40,0.45)"
  ctx.textAlign  = "right"
  ctx.textBaseline = "bottom"
  ctx.fillText("lapizarra.ar", W - 8, H - 6)

  const a = document.createElement("a")
  a.download = filename.endsWith(".png") ? filename : filename + ".png"
  a.href = canvas.toDataURL("image/png")
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function downloadCsv(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(r =>
    headers.map(h => {
      const v = r[h]
      const s = v == null ? "" : String(v)
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(",")
  )
  const csv  = [headers.join(","), ...rows].join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ChartDownload({ csvData, filename, chartRef }: ChartDownloadProps) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)

  const handlePng = async () => {
    if (!chartRef?.current) { alert("No hay referencia al gráfico."); return }
    setLoading(true)
    setOpen(false)
    try { await capturePng(chartRef.current, filename) }
    catch (e) { console.error(e); alert("Error al generar la imagen.") }
    finally { setLoading(false) }
  }

  return (
    <div ref={btnRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        style={{
          background: "none", border: "1px solid #222", borderRadius: 3,
          color: "#888", cursor: "pointer", fontFamily: "monospace",
          fontSize: 9, letterSpacing: 0.5, padding: "3px 8px",
          transition: "color 0.1s, border-color 0.1s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#FFA028" }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#555" }}
      >
        {loading ? "..." : "↓ Descargar ▾"}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0,
            background: "#0d0d0d", border: "1px solid #222",
            borderRadius: 4, zIndex: 1000, minWidth: 130,
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}>
            <button
              onClick={() => { setOpen(false); downloadCsv(csvData, filename) }}
              style={{
                display: "block", width: "100%", padding: "7px 12px",
                background: "none", border: "none", textAlign: "left",
                color: "#ccc", cursor: "pointer", fontFamily: "monospace", fontSize: 10,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1a1a1a" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none" }}
            >
              ↓ CSV
            </button>
            {chartRef && (
              <button
                onClick={handlePng}
                style={{
                  display: "block", width: "100%", padding: "7px 12px",
                  background: "none", border: "none", borderTop: "1px solid #161616",
                  textAlign: "left", color: "#ccc", cursor: "pointer",
                  fontFamily: "monospace", fontSize: 10,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1a1a1a" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none" }}
              >
                ↓ PNG <span style={{ fontSize: 8, color: "#888" }}>lapizarra.ar</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
