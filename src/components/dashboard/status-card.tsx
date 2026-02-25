"use client"

interface ScraperStatus {
  name: string
  source: string
  lastRun: Date | string | null
  status: "success" | "error" | "running" | "pending"
  recordsAdded?: number
  message?: string
}

interface StatusCardProps {
  scrapers: ScraperStatus[]
  onRefresh?: (source: string) => void
  onRefreshAll?: () => void
}

function statusDot(status: ScraperStatus["status"]): string {
  switch (status) {
    case "success": return "ok"
    case "error": return "error"
    case "running": return "running"
    default: return "pending"
  }
}

function statusLabel(status: ScraperStatus["status"]): string {
  switch (status) {
    case "success": return "OK"
    case "error": return "ERR"
    case "running": return "RUN"
    default: return "PEND"
  }
}

function statusColor(status: ScraperStatus["status"]): string {
  switch (status) {
    case "success": return "#4AF6C3"
    case "error": return "#FF433D"
    case "running": return "#FFA028"
    default: return "#555555"
  }
}

function fmtDt(date: Date | string | null): string {
  if (!date) return "-"
  try {
    const d = new Date(date)
    return d.toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return "-"
  }
}

export function StatusCard({ scrapers, onRefresh, onRefreshAll }: StatusCardProps) {
  return (
    <div className="bbg-panel">
      <div className="bbg-panel-header flex items-center justify-between">
        <span>DATA SOURCES STATUS</span>
        {onRefreshAll && (
          <button
            onClick={onRefreshAll}
            className="text-[10px] px-2 py-0.5 uppercase tracking-wider cursor-pointer"
            style={{ color: "#0068FF", border: "1px solid #333333", background: "#0a0a0a" }}
          >
            Refresh All
          </button>
        )}
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: "12px" }}></th>
            <th>Source</th>
            <th>Status</th>
            <th>Last Run</th>
            <th className="text-right">Records</th>
            <th>Message</th>
            <th style={{ width: "50px" }}></th>
          </tr>
        </thead>
        <tbody>
          {scrapers.map((s, i) => (
            <tr key={s.source} style={{ background: i % 2 === 0 ? "#000000" : "#060606" }}>
              <td>
                <span className={`status-dot ${statusDot(s.status)}`} />
              </td>
              <td style={{ color: "#FFA028", fontWeight: 600 }}>{s.name.toUpperCase()}</td>
              <td style={{ color: statusColor(s.status), fontWeight: 600, fontSize: "10px" }}>
                {statusLabel(s.status)}
              </td>
              <td style={{ color: "#888888", fontSize: "10px" }}>{fmtDt(s.lastRun)}</td>
              <td className="text-right" style={{ color: s.recordsAdded ? "#FFFFFF" : "#555555" }}>
                {s.recordsAdded ?? "-"}
              </td>
              <td style={{ color: s.status === "error" ? "#FF433D" : "#555555", fontSize: "10px", whiteSpace: "normal", maxWidth: "300px" }}>
                {s.message || "-"}
              </td>
              <td>
                {onRefresh && (
                  <button
                    onClick={() => onRefresh(s.source)}
                    disabled={s.status === "running"}
                    className="text-[9px] px-1.5 py-0.5 cursor-pointer uppercase"
                    style={{
                      color: s.status === "running" ? "#555555" : "#0068FF",
                      border: "1px solid #222222",
                      background: "#0a0a0a",
                    }}
                  >
                    Run
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Schedule info */}
      <div style={{ padding: "6px 8px", borderTop: "1px solid #111111", fontSize: "10px", color: "#555555" }}>
        SCHEDULE: DAILY 17:00 ART (20:00 UTC) — MON-FRI POST MARKET CLOSE
      </div>
    </div>
  )
}
