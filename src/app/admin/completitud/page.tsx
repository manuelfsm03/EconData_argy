"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"

const SCRAPERS = [
  { id: "all",         label: "Todo",           icon: "⚡", desc: "Corre todos los scrapers" },
  { id: "rava",        label: "Rava (bonos)",    icon: "📈", desc: "Bonos y acciones Rava" },
  { id: "finanzasargy",label: "FinanzasARGY",    icon: "💹", desc: "Datos de mercado local" },
  { id: "criptoya",    label: "CriptoYa",        icon: "₿",  desc: "Cotizaciones crypto" },
  { id: "bcra",        label: "BCRA",            icon: "🏦", desc: "Reservas y tasas BCRA" },
  { id: "indec",       label: "INDEC",           icon: "📊", desc: "Macro / IPC / EMAE" },
  { id: "rss",         label: "RSS Noticias",    icon: "📰", desc: "Feeds de noticias" },
]

type CheckStatus = "ok" | "stale" | "empty" | "hardcoded" | "error"

interface CheckResult {
  id:          string
  label:       string
  categoria:   string
  status:      CheckStatus
  mensaje:     string
  hardcoded?:  string[]
  freshnessMs?: number
  latency_ms:  number
}

interface Report {
  generated_at: string
  elapsed_ms:   number
  summary:      Record<string, number>
  checks:       CheckResult[]
}

const STATUS_CFG: Record<CheckStatus, { color: string; bg: string; label: string; icon: string }> = {
  ok:        { color: "#4AF6C3", bg: "#0a1a14", label: "OK",         icon: "✓" },
  stale:     { color: "#FFD54F", bg: "#1a1600", label: "DESACTUAL.", icon: "⏱" },
  empty:     { color: "#FFA028", bg: "#1a0d00", label: "VACÍO",      icon: "○" },
  hardcoded: { color: "#ce93d8", bg: "#150a1a", label: "HARDCODED",  icon: "⚠" },
  error:     { color: "#FF433D", bg: "#1a0808", label: "ERROR",      icon: "✗" },
}

const CATS = ["Cambiario", "Macro", "Fiscal", "Mercados", "Noticias"]

export default function CompletitudPage() {
  const router = useRouter()
  const [password,      setPassword]      = useState("")
  const [report,        setReport]        = useState<Report | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [scrapeStatus,  setScrapeStatus]  = useState<Record<string, "idle"|"running"|"ok"|"error">>({})
  const [scrapeLogs,    setScrapeLogs]    = useState<Record<string, string>>({})

  const runScraper = useCallback(async (id: string) => {
    if (!password) return
    setScrapeStatus(s => ({ ...s, [id]: "running" }))
    setScrapeLogs(l => ({ ...l, [id]: "" }))
    try {
      const endpoint = id === "all" ? "/api/cron" : `/api/scrape/${id}`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "x-admin-password": password, "Content-Type": "application/json" },
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        setScrapeStatus(s => ({ ...s, [id]: "error" }))
        setScrapeLogs(l => ({ ...l, [id]: data?.error as string ?? `HTTP ${res.status}` }))
      } else {
        setScrapeStatus(s => ({ ...s, [id]: "ok" }))
        const msg = data?.message ?? data?.status ?? "Completado"
        setScrapeLogs(l => ({ ...l, [id]: String(msg) }))
      }
    } catch (e) {
      setScrapeStatus(s => ({ ...s, [id]: "error" }))
      setScrapeLogs(l => ({ ...l, [id]: String(e) }))
    }
  }, [password])

  const run = useCallback(async () => {
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/completitud")
      if (res.status === 401) { setError("Contraseña incorrecta"); return }
      if (!res.ok) { setError(`Error ${res.status}`); return }
      setReport(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [password])

  return (
    <main style={{
      minHeight:   "100vh",
      background:  "#000",
      color:       "#ccc",
      fontFamily:  "monospace",
      padding:     "32px 20px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 8 }}>
            LA PIZARRA · ADMIN
          </div>
          <h1 style={{ fontSize: 18, color: "#fff", margin: "0 0 4px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            Agente de Completitud
            <button
              onClick={async () => { await fetch("/api/admin/login", { method: "DELETE" }); router.push("/admin/login") }}
              style={{ fontSize: 9, color: "#333", background: "none", border: "none", cursor: "pointer", letterSpacing: 1 }}
            >
              SALIR →
            </button>
          </h1>
          <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
            Verifica que todos los endpoints tengan datos reales, frescos y sin hardcode.
          </p>
        </div>

        {/* Run */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          <button
            onClick={run}
            disabled={loading}
            style={{
              background:   loading ? "#111" : "#FFA028",
              color:        loading ? "#444" : "#000",
              border:       "none",
              borderRadius: 3,
              padding:      "10px 24px",
              fontSize:     11,
              fontFamily:   "monospace",
              fontWeight:   700,
              cursor:       loading ? "default" : "pointer",
              letterSpacing: 1,
            }}
          >
            {loading ? "VERIFICANDO..." : "▶ VERIFICAR AHORA"}
          </button>
        </div>

        {error && (
          <div style={{ color: "#FF433D", fontSize: 11, marginBottom: 16 }}>⚠ {error}</div>
        )}

        {/* ── Sección Actualizar ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, borderBottom: "1px solid #0d0d0d", paddingBottom: 6 }}>
            Actualizar fuentes de datos
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SCRAPERS.map(sc => {
              const st = scrapeStatus[sc.id] ?? "idle"
              const log = scrapeLogs[sc.id]
              const isAll = sc.id === "all"
              return (
                <div
                  key={sc.id}
                  style={{
                    background:   "#080808",
                    border:       `1px solid ${st === "ok" ? "#4AF6C344" : st === "error" ? "#FF433D44" : st === "running" ? "#FFA02844" : isAll ? "#FFA028" : "#1a1a1a"}`,
                    borderRadius: 4,
                    padding:      "10px 14px",
                    minWidth:     isAll ? "100%" : 140,
                    display:      "flex",
                    alignItems:   "center",
                    gap:          10,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{sc.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: "#ccc", fontWeight: 600, marginBottom: 2 }}>{sc.label}</div>
                    <div style={{ fontSize: 9, color: "#444" }}>
                      {log || sc.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => runScraper(sc.id)}
                    disabled={!password || st === "running"}
                    style={{
                      background:   st === "running" ? "#111" : isAll ? "#FFA028" : "#0d0d0d",
                      color:        st === "running" ? "#444" : isAll ? "#000" : st === "ok" ? "#4AF6C3" : st === "error" ? "#FF433D" : "#666",
                      border:       `1px solid ${isAll ? "#FFA028" : "#222"}`,
                      borderRadius: 3,
                      padding:      "5px 12px",
                      fontSize:     9,
                      fontFamily:   "monospace",
                      fontWeight:   700,
                      cursor:       !password || st === "running" ? "default" : "pointer",
                      letterSpacing: 1,
                      whiteSpace:   "nowrap",
                    }}
                  >
                    {st === "running" ? "···" : st === "ok" ? "✓ OK" : st === "error" ? "✗ ERROR" : isAll ? "⚡ ACTUALIZAR TODO" : "↻ UPDATE"}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Report */}
        {report && (
          <>
            {/* Resumen */}
            <div style={{
              display:      "flex",
              gap:          8,
              flexWrap:     "wrap",
              marginBottom: 28,
            }}>
              {Object.entries(STATUS_CFG).map(([status, cfg]) => {
                const count = report.summary[status] ?? 0
                return (
                  <div key={status} style={{
                    background:   count > 0 && status !== "ok" ? cfg.bg : "#080808",
                    border:       `1px solid ${count > 0 ? cfg.color : "#1a1a1a"}`,
                    borderRadius: 4,
                    padding:      "10px 16px",
                    minWidth:     80,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: count > 0 ? cfg.color : "#333" }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 8, color: "#444", letterSpacing: 1 }}>{cfg.label}</div>
                  </div>
                )
              })}
              <div style={{
                background: "#080808", border: "1px solid #111", borderRadius: 4,
                padding: "10px 16px", minWidth: 80,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#333" }}>
                  {report.elapsed_ms}ms
                </div>
                <div style={{ fontSize: 8, color: "#444", letterSpacing: 1 }}>DURACIÓN</div>
              </div>
            </div>

            {/* Checks por categoría */}
            {CATS.map(cat => {
              const checks = report.checks.filter(c => c.categoria === cat)
              if (!checks.length) return null
              return (
                <div key={cat} style={{ marginBottom: 24 }}>
                  <div style={{
                    fontSize: 9, color: "#444", letterSpacing: 2,
                    textTransform: "uppercase", marginBottom: 8,
                    borderBottom: "1px solid #0d0d0d", paddingBottom: 6,
                  }}>
                    {cat}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {checks.map(c => {
                      const cfg = STATUS_CFG[c.status]
                      return (
                        <div key={c.id} style={{
                          display:      "flex",
                          alignItems:   "flex-start",
                          gap:          12,
                          background:   "#080808",
                          border:       `1px solid ${c.status !== "ok" ? cfg.color + "44" : "#111"}`,
                          borderLeft:   `3px solid ${cfg.color}`,
                          borderRadius: 3,
                          padding:      "10px 12px",
                        }}>
                          {/* Ícono */}
                          <span style={{ fontSize: 13, color: cfg.color, flexShrink: 0, marginTop: 1 }}>
                            {cfg.icon}
                          </span>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 11, color: "#ccc", fontWeight: 600 }}>{c.label}</span>
                              <span style={{
                                fontSize: 8, padding: "1px 6px",
                                background: cfg.bg, color: cfg.color,
                                borderRadius: 2, letterSpacing: 1,
                              }}>
                                {cfg.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: "#666" }}>{c.mensaje}</div>
                            {c.hardcoded?.map((h, i) => (
                              <div key={i} style={{
                                fontSize: 9, color: "#ce93d8",
                                marginTop: 4, display: "flex", alignItems: "center", gap: 4,
                              }}>
                                <span>⚠</span> {h}
                              </div>
                            ))}
                          </div>

                          {/* Latencia */}
                          <div style={{ fontSize: 9, color: "#333", flexShrink: 0 }}>
                            {c.latency_ms}ms
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div style={{ fontSize: 9, color: "#333", marginTop: 8 }}>
              Generado: {new Date(report.generated_at).toLocaleString("es-AR")}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
