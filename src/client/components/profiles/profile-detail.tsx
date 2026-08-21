"use client"

import { useState } from "react"
import { X, ExternalLink, Pencil } from "lucide-react"
import { describirCondicion } from "@/lib/prediction-contract"
import type { Prediccion, EstadoPrediccion } from "@/lib/prediction-contract"
import type { UserProfile, BadgeLevel } from "./mock-profiles"
import { ProfileEditForm } from "./profile-edit-form"

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(nombre: string): string {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

function aciertoPct(aciertos: number, total: number): string {
  if (total === 0) return "—"
  return Math.round((aciertos / total) * 100) + "%"
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k"
  return String(n)
}

function fechaLegible(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {
      day: "numeric", month: "short", year: "numeric",
    })
  } catch {
    return iso
  }
}

function badgeColors(nivel: BadgeLevel): { color: string; bg: string; border: string } {
  switch (nivel) {
    case "Quant":    return { color: "#A47FCA", bg: "rgba(164,127,202,0.12)", border: "rgba(164,127,202,0.4)" }
    case "Experto":  return { color: "var(--yellow)",    bg: "rgba(240,192,64,0.10)",  border: "rgba(240,192,64,0.4)" }
    case "Pro":      return { color: "var(--positive)",  bg: "rgba(107,212,168,0.10)", border: "rgba(107,212,168,0.4)" }
    case "Trader":   return { color: "var(--amber)",     bg: "rgba(232,148,74,0.10)",  border: "rgba(232,148,74,0.4)" }
    case "Analista": return { color: "var(--sky)",       bg: "rgba(116,169,201,0.10)", border: "rgba(116,169,201,0.4)" }
    case "Novato":   return { color: "var(--text-mute)", bg: "transparent",            border: "var(--border-hi)" }
  }
}

// ── ProfileDetail ──────────────────────────────────────────────────────────────

export interface ProfileDetailProps {
  profile: UserProfile | null
  onClose: () => void
  onUpdated?: (updated: UserProfile) => void
}

export function ProfileDetail({ profile, onClose, onUpdated }: ProfileDetailProps) {
  const isOpen = profile !== null
  const [localProfile, setLocalProfile] = useState<UserProfile | null>(null)

  // Sincronizar cuando cambia el perfil externo
  const displayProfile = localProfile ?? profile

  const handleUpdated = (updated: UserProfile) => {
    setLocalProfile(updated)
    onUpdated?.(updated)
  }

  const handleClose = () => {
    setLocalProfile(null)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={handleClose}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 199,
          }}
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={displayProfile?.nombre ?? "Perfil"}
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: 420,
          background: "var(--bg-elev)",
          borderLeft: "1px solid var(--border-hi)",
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      >
        {displayProfile && (
          <PanelContent
            profile={displayProfile}
            onClose={handleClose}
            onUpdated={handleUpdated}
          />
        )}
      </div>
    </>
  )
}

// ── PanelContent (rendered only when profile is set) ──────────────────────────

function PanelContent({
  profile,
  onClose,
  onUpdated,
}: {
  profile: UserProfile
  onClose: () => void
  onUpdated: (updated: UserProfile) => void
}) {
  const [editMode, setEditMode] = useState(false)
  const badge = badgeColors(profile.nivel)
  const aciertosLabel = aciertoPct(profile.stats.aciertos, profile.stats.totalPrediciones)
  const memberSince = fechaLegible(profile.fechaAlta)

  const handleUpdated = (updated: UserProfile) => {
    setEditMode(false)
    onUpdated(updated)
  }

  if (editMode) {
    return (
      <>
        {/* Sticky header en modo edición */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "var(--bg-elev-2)",
          borderBottom: "1px solid var(--border)",
          padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 1 }}>
            Editando perfil — @{profile.handle}
          </span>
          <button
            onClick={() => setEditMode(false)}
            aria-label="Cancelar edición"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-mute)", display: "flex", alignItems: "center", padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <ProfileEditForm
          profile={profile}
          onUpdated={handleUpdated}
          onCancel={() => setEditMode(false)}
        />
      </>
    )
  }

  return (
    <>
      {/* ── Sticky header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-elev-2)",
        borderBottom: "1px solid var(--border)",
        padding: "10px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>
          Perfil — @{profile.handle}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {profile.isCurrentUser && (
            <button
              onClick={() => setEditMode(true)}
              aria-label="Editar perfil"
              title="Editar mi perfil"
              style={{
                background: "none",
                border: "1px solid var(--border-hi)",
                borderRadius: 4,
                cursor: "pointer",
                color: "var(--text-dim)",
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              <Pencil size={11} />
              Editar
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-mute)", display: "flex", alignItems: "center", padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Avatar + Name ── */}
      <div style={{ padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: profile.avatarBg,
            border: "1px solid var(--border-hi)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: "var(--text)",
            flexShrink: 0, letterSpacing: 0.5,
          }}>
            {initials(profile.nombre)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                {profile.nombre}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                textTransform: "uppercase",
                color: badge.color, background: badge.bg,
                border: `1px solid ${badge.border}`,
                padding: "2px 7px", borderRadius: 3,
              }}>
                {profile.nivel}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
              <span style={{ fontSize: 11, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
                @{profile.handle}
              </span>
              {profile.linkedin && (
                <a
                  href={profile.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--sky)", fontSize: 10, textDecoration: "none" }}
                >
                  <ExternalLink size={11} />
                  LinkedIn
                </a>
              )}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-mute)", marginTop: 4 }}>
              Miembro desde {memberSince}
            </div>
          </div>
        </div>

        {/* Bio */}
        <p style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6, marginTop: 12, marginBottom: 0 }}>
          {profile.bio}
        </p>
      </div>

      {/* ── Stats grid ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
        gap: 1, padding: "0 1px", borderTop: "1px solid var(--border)",
      }}>
        {[
          { label: "Puntos",       value: profile.stats.puntos.toLocaleString("es-AR"), color: "var(--amber)" },
          { label: "Seguidores",   value: fmtNum(profile.stats.seguidores), color: "var(--text)" },
          { label: "Publicaciones",value: String(profile.stats.posts), color: "var(--text)" },
          { label: "Aciertos",     value: `${profile.stats.aciertos} / ${profile.stats.totalPrediciones} · ${aciertosLabel}`, color: "var(--positive)" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--bg)", padding: "12px 16px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-data)", color: s.color }}>
              {s.value}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Racha ── */}
      {profile.streak > 0 && (
        <div style={{
          padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--bg)", borderTop: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>Racha activa</span>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-data)", color: profile.streak >= 20 ? "var(--amber)" : "var(--text-dim)" }}>
            {profile.streak} días
          </span>
          {profile.streak >= 20 && (
            <span style={{ fontSize: 9, color: "var(--amber)", border: "1px solid rgba(232,148,74,0.3)", padding: "2px 7px", borderRadius: 3 }}>
              RACHA ACTIVA
            </span>
          )}
        </div>
      )}

      {/* ── Top Acciones ── */}
      {profile.topAcciones.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
          <div style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Cartera declarada
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {profile.topAcciones.map((a) => (
              <div key={a.ticker} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "var(--amber)",
                  fontFamily: "var(--font-data)", minWidth: 46,
                }}>
                  {a.ticker}
                </span>
                <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2 }}>
                  <div style={{
                    width: `${a.conviccion}%`, height: "100%", borderRadius: 2,
                    background: a.conviccion >= 75 ? "var(--positive)" : a.conviccion >= 50 ? "var(--amber)" : "var(--text-dim)",
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <span style={{
                  fontSize: 10, fontFamily: "var(--font-data)", fontWeight: 700,
                  color: a.conviccion >= 75 ? "var(--positive)" : a.conviccion >= 50 ? "var(--amber)" : "var(--text-dim)",
                  minWidth: 30, textAlign: "right",
                }}>
                  {a.conviccion}%
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-mute)", marginTop: 8 }}>
            Convicción declarada por el usuario · No es asesoramiento de inversión
          </div>
        </div>
      )}

      {/* ── Intereses ── */}
      {profile.intereses.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <div style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Intereses
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {profile.intereses.map((tag) => (
              <span key={tag} style={{
                fontSize: 10, color: "var(--text-dim)",
                background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)",
                borderRadius: 99, padding: "3px 10px",
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Predicciones ── */}
      <PrediccionesPanel predicciones={profile.predicciones ?? []} />
    </>
  )
}

// ── PrediccionesPanel ─────────────────────────────────────────────────────────

const ESTADO_STYLE: Record<EstadoPrediccion, { label: string; color: string; bg: string; border: string }> = {
  abierta:  { label: "ABIERTA",  color: "var(--amber)",    bg: "rgba(232,148,74,0.1)",  border: "rgba(232,148,74,0.35)" },
  acertada: { label: "ACERTADA", color: "var(--positive)", bg: "rgba(107,212,168,0.1)", border: "rgba(107,212,168,0.35)" },
  errada:   { label: "ERRADA",   color: "var(--negative)", bg: "rgba(230,123,107,0.1)", border: "rgba(230,123,107,0.35)" },
  anulada:  { label: "ANULADA",  color: "var(--text-mute)",bg: "transparent",           border: "var(--border-hi)" },
}

const METRICA_UNIDAD: Record<string, string> = {
  precio: "", tir: "%", paridad: "%", spread: " bps", variacion_pct: "%",
}

function fmtValor(v: number, metrica: string): string {
  const u = METRICA_UNIDAD[metrica] ?? ""
  if (metrica === "precio" && v > 1000) return `$${v.toLocaleString("es-AR")}${u}`
  if (metrica === "precio") return `$${v.toFixed(2)}${u}`
  return `${v.toFixed(2)}${u}`
}

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
  } catch { return iso.slice(0, 10) }
}


function PrediccionesPanel({ predicciones }: { predicciones: Prediccion[] }) {
  if (predicciones.length === 0) {
    return (
      <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Predicciones
        </div>
        <div style={{ fontSize: 10, color: "var(--text-mute)" }}>Sin predicciones todavía.</div>
      </div>
    )
  }

  // Orden: abiertas primero, luego por fecha más reciente
  const ordenadas = [...predicciones].sort((a, b) => {
    if (a.estado === "abierta" && b.estado !== "abierta") return -1
    if (a.estado !== "abierta" && b.estado === "abierta") return 1
    return new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime()
  })

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingBottom: 20 }}>
      <div style={{
        fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase",
        letterSpacing: 1, padding: "14px 16px 10px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>Predicciones</span>
        <span style={{ fontFamily: "var(--font-data)", color: "var(--border-hi)" }}>—</span>
        <span style={{ color: "var(--positive)", fontFamily: "var(--font-data)" }}>
          {predicciones.filter(p => p.estado === "acertada").length}
        </span>
        <span>acertadas</span>
        <span style={{ color: "var(--negative)", fontFamily: "var(--font-data)" }}>
          {predicciones.filter(p => p.estado === "errada").length}
        </span>
        <span>erradas</span>
        <span style={{ color: "var(--amber)", fontFamily: "var(--font-data)" }}>
          {predicciones.filter(p => p.estado === "abierta").length}
        </span>
        <span>abiertas</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {ordenadas.map((pred, i) => {
          const est = ESTADO_STYLE[pred.estado]
          const condicion = describirCondicion(pred)

          return (
            <div key={pred.id} style={{
              padding: "11px 16px",
              background: i % 2 === 0 ? "var(--bg)" : "transparent",
              borderTop: i === 0 ? "none" : "1px solid var(--border)",
            }}>
              {/* Header: ticker + estado + fecha */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "var(--amber)",
                  fontFamily: "var(--font-data)",
                  background: "var(--amber-soft)",
                  border: "1px solid rgba(232,148,74,0.3)",
                  borderRadius: 3, padding: "1px 6px",
                }}>
                  {pred.activo}
                </span>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: est.color, background: est.bg,
                  border: `1px solid ${est.border}`,
                  borderRadius: 3, padding: "1px 6px",
                }}>
                  {est.label}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{
                  fontSize: 9, color: "var(--text-mute)",
                  fontFamily: "var(--font-data)", whiteSpace: "nowrap",
                }}>
                  {fechaCorta(pred.fechaEntrada)}
                </span>
              </div>

              {/* Tesis */}
              <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
                {pred.tesis}
              </p>

              {/* Contrato (condición verificable) */}
              <div style={{
                background: "var(--bg-elev-2)",
                border: "1px solid var(--border)",
                borderLeft: `2px solid ${est.color}`,
                padding: "7px 10px",
                fontSize: 10, fontFamily: "var(--font-data)",
              }}>
                <div style={{ color: "var(--text-dim)", marginBottom: 4, lineHeight: 1.4 }}>
                  <span style={{ color: "var(--text-mute)", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>
                    Condición{" "}
                  </span>
                  {condicion}
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Entrada{" "}
                    </span>
                    <span style={{ color: "var(--text)" }}>
                      {fmtValor(pred.valorEntrada, pred.metrica)}
                    </span>
                    <span style={{ color: "var(--text-mute)", fontSize: 9, marginLeft: 4 }}>
                      · {fechaCorta(pred.fechaEntrada)}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Horizonte{" "}
                    </span>
                    <span style={{ color: "var(--text)" }}>{pred.horizonte}</span>
                  </div>
                </div>

                {/* Resolución */}
                {pred.estado !== "abierta" && pred.valorResolucion != null && (
                  <div style={{
                    marginTop: 6, paddingTop: 6,
                    borderTop: "1px solid var(--border)",
                    display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
                  }}>
                    <div>
                      <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                        Resolución{" "}
                      </span>
                      <span style={{ color: est.color, fontWeight: 700 }}>
                        {fmtValor(pred.valorResolucion, pred.metrica)}
                      </span>
                    </div>
                    {pred.fechaResuelta && (
                      <div>
                        <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                          Fecha{" "}
                        </span>
                        <span style={{ color: "var(--text-dim)" }}>{fechaCorta(pred.fechaResuelta)}</span>
                      </div>
                    )}
                    {pred.fuente && (
                      <div>
                        <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                          Fuente{" "}
                        </span>
                        <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-data)", fontSize: 9 }}>{pred.fuente}</span>
                      </div>
                    )}
                  </div>
                )}
                {pred.estado === "abierta" && (
                  <div style={{ marginTop: 5, fontSize: 9, color: "var(--text-mute)" }}>
                    Vence {pred.fechaResolucion.slice(0, 10)} · pendiente de resolución automática
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
