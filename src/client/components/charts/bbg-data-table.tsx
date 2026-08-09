"use client"

interface ColumnConfig {
  key: string
  header: string
  format?: "currency" | "percentage" | "number"
  currency?: "ARS" | "USD"
}

interface BBGDataTableProps {
  data: Record<string, unknown>[]
  columns: ColumnConfig[]
  title: string
  maxRows?: number
}

function fmtCell(value: unknown, format?: string, currency?: string): string {
  if (value == null) return "-"
  const num = Number(value)
  if (isNaN(num)) return String(value)

  if (format === "percentage") {
    return num.toFixed(2) + "%"
  }
  if (format === "currency") {
    const prefix = currency === "USD" ? "USD " : "$ "
    return prefix + num.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  return num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })
  } catch { return dateStr }
}

export function BBGDataTable({ data, columns, title, maxRows }: BBGDataTableProps) {
  const rows = maxRows ? data.slice(-maxRows) : data

  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header">{title}</div>
      <div className="overflow-auto" style={{ maxHeight: "300px" }}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              {columns.map((col) => (
                <th key={col.key} className="text-right">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg)" }}>
                <td style={{ color: "#999999", fontSize: "10px" }}>
                  {fmtDate(String(row.date))}
                </td>
                {columns.map((col) => (
                  <td key={col.key} className="text-right" style={{ color: "var(--text)", fontWeight: 600 }}>
                    {fmtCell(row[col.key], col.format, col.currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
