"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Degradado {
  id:        string
  label:     string
  status:    string
  mensaje:   string
  hardcoded: string[]
}

interface MonitorRun {
  id?:              number
  created_at:       string
  healthy:          boolean
  nivel:            string
  checks_total:     number
  degradados_count: number
  degradados:       Degradado[]
  elapsed_ms:       number
  mensaje?:         string
  summary?:         Record<string, number>
}

const NIVEL_CFG: Record<string, { color: string; label: string }> = {
  ok:      { color: "#4AF6C3", label: "SALUDABLE"  },
  bajo:    { color: "#ce93d8", label: "HARDCODED"  },
  medio:   { color: "#FFD54F", label: "DESACTUAL." },
  alto:    { color: "#FFA028", label: "VACÍO"      },
  critico: { color: "#FF433D", label: "CRÍTICO"    },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return "hace un momento"
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)} días`
}

export default function MonitorPage() {
  const router  = useRouter()
  const [runs,      setRuns]     = useState<MonitorRun[]>([])
  const [running,   setRunning]  = useState(false)
  const [lastRun,   setLastRun]  = useState<MonitorRun | null>(null)
  const [expanded,  setExpanded] = useState<number | null>(null)
  const [scraping,  setScraping] = useState(false)
  const [scrapeLog, setScrapeLog] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/admin/monitor")
    if (res.status === 401) { router.push("/admin/login"); return }
    if (!res.ok) return
    const data = await res.json() as { runs: MonitorRun[] }
    setRuns(data.runs ?? [])
  }, [router])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const runScraping = useCallback(async () => {
    setScraping(true)
    setScrapeLog(null)
    const res = await fetch("/api/admin/scraping-agent", { method: "POST" })
    if (res.status === 401) { router.push("/admin/login"); return }
    const data = await res.json() as { mensaje: string; resueltos?: { label: string }[]; siguen_rotos?: { label: string; status: string }[]; elapsed_ms: number }
    setScrapeLog(data.mensaje)
    setScraping(false)
    // Re-verificar estado después del scraping
    setTimeout(fetchHistory, 2000)
  }, [router, fetchHistory])

  const runNow = useCallback(async () => {
    setRunning(true)
    const res = await fetch("/api/admin/monitor", { method: "POST" })
    if (res.status === 401) { router.push("/admin/login"); return }
    const data = await res.json() as MonitorRun
    setLastRun(data)
    setRunning(false)
    fetchHistory()
  }, [router, fetchHistory])

  const latest  = lastRun ?? runs[0]
  const nivelCfg = latest ? (NIVEL_CFG[latest.nivel] ?? NIVEL_CFG.ok) : null

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#ccc", fontFamily: "monospace", padding: "32px 20px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 6 }}>LA PIZARRA · ADMIN</div>
              <h1 style={{ fontSize: 18, color: "#fff", margin: "0 0 4px", fontWeight: 700 }}>Agente Monitor</h1>
              <p style={{ fontSize: 11, color: "#444", margin: 0 }}>Historial de verificaciones automáticas del dashboard.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => router.push("/admin/completitud")}
                style={{ fontSize: 9, color: "#444", background: "none", border: "1px solid #1a1a1a", borderRadius: 3, padding: "6px 12px", cursor: "pointer", fontFamily: "monospace" }}>
                COMPLETITUD
              </button>
              <button onClick={async () => { await fetch("/api/admin/login", { method: "DELETE" }); router.push("/admin/login") }}
                style={{ fontSize: 9, color: "#333", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>
                SALIR →
              </button>
            </div>
          </div>
        </div>

        {/* Estado actual + botón */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          {/* Status card */}
          <div style={{
            flex:         1, minWidth: 220,
            background:   latest ? (latest.healthy ? "#0a1a14" : "#1a0808") : "#080808",
            border:       `1px solid ${nivelCfg?.color ?? "#1a1a1a"}`,
            borderRadius: 6, padding: "16px 20px",
          }}>
            <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 8 }}>ESTADO ACTUAL</div>
            {latest ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, color: nivelCfg?.color ?? "#ccc", marginBottom: 4 }}>
                  {nivelCfg?.label}
                </div>
                <div style={{ fontSize: 10, color: "#555" }}>
                  {latest.degradados_count === 0
                    ? `${latest.checks_total} endpoints OK`
                    : `${latest.degradados_count} de ${latest.checks_total} con problemas`}
                  {" · "}{timeAgo(latest.created_at)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "#333" }}>Sin datos aún</div>
            )}
          </div>

          {/* Contadores */}
          {latest?.summary && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {Object.entries(latest.summary).filter(([k]) => k !== "total").map(([k, v]) => (
                <div key={k} style={{ background: "#080808", border: "1px solid #111", borderRadius: 4, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: v > 0 && k !== "ok" ? "#FF433D" : v > 0 ? "#4AF6C3" : "#222" }}>{v}</div>
                  <div style={{ fontSize: 8, color: "#444", letterSpacing: 1, textTransform: "uppercase" }}>{k}</div>
                </div>
              ))}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={runNow} disabled={running}
              style={{
                background: running ? "#111" : "#FFA028", color: running ? "#444" : "#000",
                border: "none", borderRadius: 4, padding: "10px 20px",
                fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                cursor: running ? "default" : "pointer", letterSpacing: 1, minWidth: 160,
              }}>
              {running ? "VERIFICANDO ···" : "▶ VERIFICAR AHORA"}
            </button>
            <button onClick={runScraping} disabled={scraping || running}
              style={{
                background: scraping ? "#111" : "#0a1a0a", color: scraping ? "#444" : "#4AF6C3",
                border: "1px solid #4AF6C344", borderRadius: 4, padding: "10px 20px",
                fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                cursor: scraping ? "default" : "pointer", letterSpacing: 1, minWidth: 160,
              }}>
              {scraping ? "ACTUALIZANDO ···" : "⟳ SCRAPING INTELIGENTE"}
            </button>
            {scrapeLog && (
              <div style={{ fontSize: 9, color: scrapeLog.startsWith("✓") ? "#4AF6C3" : "#FFA028", maxWidth: 160, lineHeight: 1.4 }}>
                {scrapeLog}
              </div>
            )}
          </div>
        </div>

        {/* Degradaciones del último run */}
        {latest?.degradados?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, color: "#FF433D", letterSpacing: 2, marginBottom: 10, borderBottom: "1px solid #1a0808", paddingBottom: 6 }}>
              PROBLEMAS DETECTADOS — ÚLTIMO RUN
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {latest.degradados.map((d) => {
                const cfg = NIVEL_CFG[d.status] ?? NIVEL_CFG.ok
                return (
                  <div key={d.id} style={{ background: "#0a0808", border: `1px solid ${cfg.color}33`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 3, padding: "8px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: "#ccc", fontWeight: 600 }}>{d.label}</span>
                      <span style={{ fontSize: 8, color: cfg.color, background: cfg.color + "22", padding: "1px 6px", borderRadius: 2 }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{d.mensaje}</div>
                    {d.hardcoded?.map((h, i) => (
                      <div key={i} style={{ fontSize: 9, color: "#ce93d8", marginTop: 2 }}>⚠ {h}</div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Historial */}
        <div>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 10, borderBottom: "1px solid #0d0d0d", paddingBottom: 6 }}>
            HISTORIAL DE RUNS
          </div>
          {runs.length === 0 ? (
            <div style={{ fontSize: 11, color: "#333", padding: "20px 0" }}>
              Sin historial — ejecutá el primer run o configurá el cron.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {runs.map((run, i) => {
                const cfg = NIVEL_CFG[run.nivel] ?? NIVEL_CFG.ok
                const isOpen = expanded === i
                return (
                  <div key={run.id ?? i}>
                    <div
                      onClick={() => setExpanded(isOpen ? null : i)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "#080808", border: `1px solid ${run.healthy ? "#111" : cfg.color + "33"}`,
                        borderRadius: 3, padding: "8px 12px", cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 10, color: cfg.color, fontWeight: 700, width: 8 }}>
                        {run.healthy ? "✓" : "!"}
                      </span>
                      <span style={{ fontSize: 9, color: cfg.color, width: 80 }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: "#666", flex: 1 }}>
                        {run.degradados_count === 0
                          ? `${run.checks_total} endpoints OK`
                          : `${run.degradados_count}/${run.checks_total} con problemas`}
                      </span>
                      <span style={{ fontSize: 9, color: "#333" }}>{timeAgo(run.created_at)}</span>
                      <span style={{ fontSize: 9, color: "#222" }}>{run.elapsed_ms}ms</span>
                      <span style={{ fontSize: 9, color: "#333" }}>{isOpen ? "▲" : "▼"}</span>
                    </div>
                    {isOpen && run.degradados?.length > 0 && (
                      <div style={{ background: "#050505", border: "1px solid #0d0d0d", borderTop: "none", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
                        {run.degradados.map((d, j) => (
                          <div key={j} style={{ fontSize: 9, color: "#555", display: "flex", gap: 8 }}>
                            <span style={{ color: (NIVEL_CFG[d.status] ?? NIVEL_CFG.ok).color }}>{d.label}</span>
                            <span>{d.mensaje}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Instrucciones cron */}
        <div style={{ marginTop: 32, background: "#080808", border: "1px solid #111", borderRadius: 4, padding: "16px" }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 10 }}>CONFIGURAR CRON AUTOMÁTICO</div>
          <div style={{ fontSize: 10, color: "#555", lineHeight: 1.8 }}>
            Agregá esto en <code style={{ color: "#888" }}>vercel.json</code> para que el monitor corra cada hora:
          </div>
          <pre style={{ fontSize: 9, color: "#4AF6C3", background: "#050505", padding: "10px", borderRadius: 3, marginTop: 8, overflow: "auto" }}>{`{
  "crons": [
    {
      "path": "/api/admin/monitor",
      "schedule": "0 * * * *"
    }
  ]
}`}</pre>
          <div style={{ fontSize: 9, color: "#333", marginTop: 8 }}>
            También necesitás setear <code style={{ color: "#555" }}>CRON_SECRET</code> en Vercel env vars.
          </div>
        </div>

      </div>
    </main>
  )
}
