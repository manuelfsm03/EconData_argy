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
    case "success": return "var(--positive)"
    case "error": return "var(--negative)"
    case "running": return "var(--amber)"
    default: return "var(--text-mute)"
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
            style={{ color: "#0068FF", border: "1px solid var(--border-hi)", background: "var(--bg-elev)" }}
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
            <tr key={s.source} style={{ background: i % 2 === 0 ? "var(--bg)" : "var(--bg)" }}>
              <td>
                <span className={`status-dot ${statusDot(s.status)}`} />
              </td>
              <td style={{ color: "var(--amber)", fontWeight: 600 }}>{s.name.toUpperCase()}</td>
              <td style={{ color: statusColor(s.status), fontWeight: 600, fontSize: "10px" }}>
                {statusLabel(s.status)}
              </td>
              <td style={{ color: "#888888", fontSize: "10px" }}>{fmtDt(s.lastRun)}</td>
              <td className="text-right" style={{ color: s.recordsAdded ? "var(--text)" : "var(--text-mute)" }}>
                {s.recordsAdded ?? "-"}
              </td>
              <td style={{ color: s.status === "error" ? "var(--negative)" : "var(--text-mute)", fontSize: "10px", whiteSpace: "normal", maxWidth: "300px" }}>
                {s.message || "-"}
              </td>
              <td>
                {onRefresh && (
                  <button
                    onClick={() => onRefresh(s.source)}
                    disabled={s.status === "running"}
                    className="text-[9px] px-1.5 py-0.5 cursor-pointer uppercase"
                    style={{
                      color: s.status === "running" ? "var(--text-mute)" : "#0068FF",
                      border: "1px solid #222222",
                      background: "var(--bg-elev)",
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
      <div style={{ padding: "6px 8px", borderTop: "1px solid var(--bg-elev-2)", fontSize: "10px", color: "var(--text-mute)" }}>
        SCHEDULE: DAILY 17:00 ART (20:00 UTC) — MON-FRI POST MARKET CLOSE
      </div>
    </div>
  )
}
