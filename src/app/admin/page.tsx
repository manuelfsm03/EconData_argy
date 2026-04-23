"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AgentCard {
  id:          string
  nombre:      string
  descripcion: string
  ruta:        string
  apiRuta:     string
  color:       string
  icono:       string
}

interface FaseResult {
  nombre:     string
  status:     string
  mensaje:    string
  elapsed_ms: number
}

interface OrchestratorResult {
  nivel:      string
  elapsed_ms: number
  timestamp:  string
  fases:      FaseResult[]
}

interface PreviewResult {
  preview: {
    problemas_count:    number
    problemas:          { label: string; status: string; mensaje: string }[]
    acciones_previstas: string[]
    requiere_accion:    boolean
    estado_actual:      Record<string, number>
  }
  approval_token: string
  expires_in_min: number
}

type OrchStep = "idle" | "previewing" | "awaiting_approval" | "executing" | "done"

interface AgentStatus {
  id:          string
  ultimo_run?: string
  nivel?:      string
  healthy?:    boolean
  cargando:    boolean
  error?:      string
}

// ── Config de agentes ─────────────────────────────────────────────────────────

const AGENTS: AgentCard[] = [
  {
    id:          "completitud",
    nombre:      "Completitud",
    descripcion: "Verifica que todos los endpoints tengan datos reales y frescos",
    ruta:        "/admin/completitud",
    apiRuta:     "/api/admin/completitud",
    color:       "#4FC3F7",
    icono:       "◎",
  },
  {
    id:          "monitor",
    nombre:      "Monitor",
    descripcion: "Historial de verificaciones. Detecta degradaciones y las guarda en Supabase",
    ruta:        "/admin/monitor",
    apiRuta:     "/api/admin/monitor",
    color:       "#FFA028",
    icono:       "◉",
  },
  {
    id:          "scraping",
    nombre:      "Scraping Inteligente",
    descripcion: "Detecta qué fuentes están desactualizadas y corre solo los scrapers necesarios",
    ruta:        "/admin/monitor",
    apiRuta:     "/api/admin/scraping-agent",
    color:       "#4AF6C3",
    icono:       "⟳",
  },
  {
    id:          "pizi",
    nombre:      "Pizi (Asistente)",
    descripcion: "Agente conversacional de cara al usuario. Métricas de uso y costo",
    ruta:        "/admin/completitud",
    apiRuta:     "/api/admin/metrics?days=1",
    color:       "#ce93d8",
    icono:       "💬",
  },
]

const NIVEL_CFG: Record<string, { color: string; label: string }> = {
  ok:      { color: "#4AF6C3", label: "OK"       },
  parcial: { color: "#FFD54F", label: "PARCIAL"  },
  error:   { color: "#FF433D", label: "ERROR"    },
  skipped: { color: "#444",    label: "SALTADO"  },
}

function timeAgo(iso?: string) {
  if (!iso) return "nunca"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return "hace un momento"
  if (m < 60) return `hace ${m}m`
  return `hace ${Math.floor(m / 60)}h`
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminHubPage() {
  const router = useRouter()
  const [step,          setStep]         = useState<OrchStep>("idle")
  const [preview,       setPreview]      = useState<PreviewResult | null>(null)
  const [approverKey,   setApproverKey]  = useState("")   // código TOTP 6 dígitos
  const [approvalError, setApprovalError]= useState<string | null>(null)
  const [lastOrch,      setLastOrch]     = useState<OrchestratorResult | null>(null)
  const [statuses,      setStatuses]     = useState<Record<string, AgentStatus>>({})

  // Ping rápido a cada agente para saber si responde
  const pingAgents = useCallback(async () => {
    setStatuses(prev => {
      const next = { ...prev }
      AGENTS.forEach(a => { next[a.id] = { id: a.id, cargando: true } })
      return next
    })

    await Promise.allSettled(AGENTS.map(async (agent) => {
      try {
        const res  = await fetch(agent.apiRuta, { signal: AbortSignal.timeout(5000) })
        const data = await res.json() as Record<string, unknown>
        setStatuses(prev => ({
          ...prev,
          [agent.id]: {
            id:       agent.id,
            cargando: false,
            nivel:    res.ok ? "ok" : "error",
            healthy:  res.ok,
            ultimo_run: (data.generated_at ?? data.timestamp ?? data.created_at) as string | undefined,
          },
        }))
      } catch {
        setStatuses(prev => ({
          ...prev,
          [agent.id]: { id: agent.id, cargando: false, nivel: "error", healthy: false },
        }))
      }
    }))
  }, [])

  useEffect(() => { pingAgents() }, [pingAgents])

  // Paso 1: preview (dry-run)
  const runPreview = useCallback(async () => {
    setStep("previewing")
    setApprovalError(null)
    try {
      const res = await fetch("/api/admin/orchestrator/preview", { method: "POST" })
      if (res.status === 401) { router.push("/admin/login"); return }
      const data = await res.json() as PreviewResult
      setPreview(data)
      setStep("awaiting_approval")
    } catch {
      setStep("idle")
    }
  }, [router])

  // Paso 2: aprobar y ejecutar
  const approve = useCallback(async () => {
    if (!preview || !approverKey) return
    setStep("executing")
    setApprovalError(null)
    try {
      const res = await fetch("/api/admin/orchestrator/approve", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token: preview.approval_token, totp_code: approverKey }),
      })
      const data = await res.json() as { resultado?: OrchestratorResult; error?: string }
      if (!res.ok) {
        setApprovalError(data.error ?? "Error de aprobación")
        setStep("awaiting_approval")
        return
      }
      if (data.resultado) setLastOrch(data.resultado)
      setStep("done")
      pingAgents()
    } catch {
      setStep("awaiting_approval")
    }
  }, [preview, approverKey, pingAgents])

  const reset = () => { setStep("idle"); setPreview(null); setApproverKey(""); setApprovalError(null) }

  const globalNivel = lastOrch?.nivel
  const globalCfg   = globalNivel ? (NIVEL_CFG[globalNivel] ?? NIVEL_CFG.ok) : null

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#ccc", fontFamily: "monospace", padding: "32px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, marginBottom: 6 }}>LA PIZARRA</div>
            <h1 style={{ fontSize: 20, color: "#fff", margin: "0 0 4px", fontWeight: 700 }}>
              Centro de Agentes
            </h1>
            <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
              Orquestación, estado y acceso a todos los agentes internos.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={() => router.push("/admin/totp-setup")}
              style={{ fontSize: 9, color: "#4FC3F7", background: "none", border: "1px solid #4FC3F744", borderRadius: 3, padding: "5px 10px", cursor: "pointer", fontFamily: "monospace" }}>
              🔐 TOTP
            </button>
            <button onClick={async () => { await fetch("/api/admin/login", { method: "DELETE" }); router.push("/admin/login") }}
              style={{ fontSize: 9, color: "#333", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}>
              SALIR →
            </button>
          </div>
        </div>

        {/* Orquestador */}
        <div style={{ background: "#080808", border: `1px solid ${globalCfg?.color ?? "#FFA028"}`, borderRadius: 6, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 8 }}>ORQUESTADOR — FLUJO BLINDADO</div>

          {/* PASO 1: idle */}
          {step === "idle" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, color: "#fff", fontWeight: 700, marginBottom: 4 }}>Monitor → Scraping → Verificación</div>
                <div style={{ fontSize: 11, color: "#555" }}>Requiere preview + aprobación de un segundo miembro del equipo.</div>
                {lastOrch && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
                    {lastOrch.fases.map(f => {
                      const cfg = NIVEL_CFG[f.status] ?? NIVEL_CFG.ok
                      return (
                        <div key={f.nombre} style={{ display: "flex", gap: 8, fontSize: 10 }}>
                          <span style={{ color: cfg.color, width: 60 }}>{cfg.label}</span>
                          <span style={{ color: "#555", width: 100 }}>{f.nombre}</span>
                          <span style={{ color: "#444" }}>{f.mensaje}</span>
                        </div>
                      )
                    })}
                    <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>Último: {timeAgo(lastOrch.timestamp)} · {lastOrch.elapsed_ms}ms</div>
                  </div>
                )}
              </div>
              <button onClick={runPreview} style={{ background: "#FFA028", color: "#000", border: "none", borderRadius: 4, padding: "12px 24px", fontSize: 12, fontWeight: 700, fontFamily: "monospace", cursor: "pointer", letterSpacing: 1 }}>
                1. VER PREVIEW →
              </button>
            </div>
          )}

          {/* PASO 1 cargando */}
          {step === "previewing" && (
            <div style={{ fontSize: 11, color: "#555" }}>Analizando estado del dashboard ···</div>
          )}

          {/* PASO 2: awaiting_approval */}
          {(step === "awaiting_approval" || step === "executing") && preview && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Resumen del preview */}
              <div style={{ background: "#050505", border: "1px solid #1a1a1a", borderRadius: 4, padding: "14px 16px" }}>
                <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 10 }}>RESUMEN DEL ANÁLISIS</div>
                <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                  {Object.entries(preview.preview.estado_actual).map(([k, v]) => (
                    <div key={k} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: v > 0 && k !== "ok" ? "#FF433D" : v > 0 ? "#4AF6C3" : "#222" }}>{v}</div>
                      <div style={{ fontSize: 8, color: "#444" }}>{k.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                {preview.preview.problemas.length > 0 ? (
                  <>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 6 }}>ENDPOINTS CON PROBLEMAS:</div>
                    {preview.preview.problemas.map((p, i) => (
                      <div key={i} style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
                        <span style={{ color: "#FFA028" }}>{p.status.toUpperCase()}</span> · {p.label} — {p.mensaje}
                      </div>
                    ))}
                    <div style={{ marginTop: 10, fontSize: 9, color: "#555" }}>ACCIONES PREVISTAS:</div>
                    {preview.preview.acciones_previstas.map((a, i) => (
                      <div key={i} style={{ fontSize: 9, color: "#4AF6C3", marginTop: 3 }}>▸ {a}</div>
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "#4AF6C3" }}>✓ Todo está OK — no se requieren acciones</div>
                )}
              </div>

              {/* Token de aprobación */}
              <div style={{ background: "#0a0a14", border: "1px solid #2a2a4a", borderRadius: 4, padding: "14px 16px" }}>
                <div style={{ fontSize: 9, color: "#4FC3F7", letterSpacing: 2, marginBottom: 8 }}>TOKEN DE APROBACIÓN</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: 4, fontFamily: "monospace" }}>
                    {preview.approval_token}
                  </span>
                  <span style={{ fontSize: 9, color: "#444" }}>· válido {preview.expires_in_min} min</span>
                </div>
                <div style={{ fontSize: 10, color: "#555" }}>
                  Compartí este token con un miembro del equipo. Ellos deben ingresar su clave de aprobador para autorizar la ejecución.
                </div>
              </div>

              {/* Input TOTP */}
              <div>
                <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, marginBottom: 6 }}>
                  2. CÓDIGO TOTP — abrí Microsoft/Google Authenticator en tu teléfono
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={approverKey}
                    onChange={e => setApproverKey(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={e => e.key === "Enter" && approve()}
                    style={{ background: "#0d0d0d", border: "1px solid #222", borderRadius: 3, color: "#ccc", fontFamily: "monospace", fontSize: 12, padding: "10px 12px", outline: "none", flex: 1, minWidth: 200 }}
                  />
                  <button
                    onClick={approve}
                    disabled={!approverKey || step === "executing"}
                    style={{ background: !approverKey || step === "executing" ? "#111" : "#4AF6C3", color: !approverKey || step === "executing" ? "#444" : "#000", border: "none", borderRadius: 3, padding: "10px 20px", fontSize: 11, fontWeight: 700, fontFamily: "monospace", cursor: !approverKey ? "default" : "pointer", letterSpacing: 1 }}
                  >
                    {step === "executing" ? "EJECUTANDO ···" : "✓ APROBAR Y EJECUTAR"}
                  </button>
                  <button onClick={reset} style={{ background: "none", border: "1px solid #222", borderRadius: 3, color: "#444", padding: "10px 14px", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>
                    CANCELAR
                  </button>
                </div>
                {approvalError && (
                  <div style={{ fontSize: 10, color: "#FF433D", marginTop: 6 }}>⚠ {approvalError}</div>
                )}
              </div>
            </div>
          )}

          {/* PASO 3: done */}
          {step === "done" && lastOrch && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: (NIVEL_CFG[lastOrch.nivel] ?? NIVEL_CFG.ok).color, fontWeight: 700, marginBottom: 8 }}>
                  {lastOrch.nivel === "ok" ? "✓ Orquestación completada exitosamente" : "⚠ Completada con observaciones"}
                </div>
                {lastOrch.fases.map(f => {
                  const cfg = NIVEL_CFG[f.status] ?? NIVEL_CFG.ok
                  return (
                    <div key={f.nombre} style={{ display: "flex", gap: 8, fontSize: 10, marginBottom: 3 }}>
                      <span style={{ color: cfg.color, width: 60 }}>{cfg.label}</span>
                      <span style={{ color: "#555", width: 100 }}>{f.nombre}</span>
                      <span style={{ color: "#444" }}>{f.mensaje}</span>
                    </div>
                  )
                })}
              </div>
              <button onClick={reset} style={{ background: "none", border: "1px solid #FFA028", borderRadius: 3, color: "#FFA028", padding: "10px 16px", fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>
                NUEVA EJECUCIÓN
              </button>
            </div>
          )}
        </div>

        {/* Grid de agentes */}
        <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 12, borderBottom: "1px solid #0d0d0d", paddingBottom: 6 }}>
          AGENTES DISPONIBLES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
          {AGENTS.map(agent => {
            const st = statuses[agent.id]
            return (
              <div
                key={agent.id}
                style={{
                  background:   "#080808",
                  border:       `1px solid ${st?.healthy ? agent.color + "44" : "#111"}`,
                  borderTop:    `3px solid ${agent.color}`,
                  borderRadius: 4,
                  padding:      "16px",
                  display:      "flex",
                  flexDirection: "column",
                  gap:          8,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, color: agent.color }}>{agent.icono}</span>
                    <span style={{ fontSize: 12, color: "#ccc", fontWeight: 700 }}>{agent.nombre}</span>
                  </div>
                  {st?.cargando ? (
                    <span style={{ fontSize: 8, color: "#333" }}>···</span>
                  ) : (
                    <span style={{
                      fontSize: 8, padding: "2px 6px", borderRadius: 2,
                      background: st?.healthy ? agent.color + "22" : "#1a0808",
                      color:      st?.healthy ? agent.color : "#FF433D",
                    }}>
                      {st?.healthy ? "ACTIVO" : "ERROR"}
                    </span>
                  )}
                </div>

                {/* Descripción */}
                <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>
                  {agent.descripcion}
                </div>

                {/* Último run */}
                {st?.ultimo_run && (
                  <div style={{ fontSize: 9, color: "#333" }}>
                    Último dato: {timeAgo(st.ultimo_run)}
                  </div>
                )}

                {/* Botón ir */}
                <button
                  onClick={() => router.push(agent.ruta)}
                  style={{
                    background:   "transparent",
                    color:        agent.color,
                    border:       `1px solid ${agent.color}44`,
                    borderRadius: 3,
                    padding:      "6px",
                    fontSize:     9,
                    fontFamily:   "monospace",
                    fontWeight:   700,
                    cursor:       "pointer",
                    letterSpacing: 1,
                    marginTop:    4,
                  }}
                >
                  ABRIR →
                </button>
              </div>
            )
          })}
        </div>

        {/* Flujo visual */}
        <div style={{ background: "#080808", border: "1px solid #111", borderRadius: 4, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 12 }}>FLUJO DE ORQUESTACIÓN</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 10 }}>
            {[
              { label: "Completitud", color: "#4FC3F7", desc: "14 checks" },
              { label: "→", color: "#333", desc: "" },
              { label: "Monitor", color: "#FFA028", desc: "detecta + logea" },
              { label: "→ si hay problemas →", color: "#333", desc: "" },
              { label: "Scraping", color: "#4AF6C3", desc: "solo lo necesario" },
              { label: "→", color: "#333", desc: "" },
              { label: "Verificación", color: "#4FC3F7", desc: "confirma fix" },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ color: step.color, fontWeight: step.desc ? 700 : 400 }}>{step.label}</div>
                {step.desc && <div style={{ fontSize: 8, color: "#333" }}>{step.desc}</div>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}
