"use client"

interface DownloadCSVProps {
  data: Record<string, unknown>[]
  filename: string
  label?: string
}

export function DownloadCSV({ data, filename, label = "↓ CSV" }: DownloadCSVProps) {
  const download = () => {
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
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename.endsWith(".csv") ? filename : filename + ".csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={download}
      disabled={!data.length}
      title="Descargar como CSV"
      style={{
        background: "none",
        border: "1px solid #222",
        borderRadius: 3,
        color: data.length ? "#555" : "#2a2a2a",
        cursor: data.length ? "pointer" : "default",
        fontFamily: "monospace",
        fontSize: 9,
        letterSpacing: 0.5,
        padding: "3px 8px",
        transition: "color 0.1s, border-color 0.1s",
      }}
      onMouseEnter={e => { if (data.length) (e.currentTarget as HTMLButtonElement).style.color = "#FFA028" }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = data.length ? "#555" : "#2a2a2a" }}
    >
      {label}
    </button>
  )
}
