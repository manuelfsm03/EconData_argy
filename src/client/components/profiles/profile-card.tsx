"use client"

import { ExternalLink } from "lucide-react"
import type { UserProfile, BadgeLevel } from "./mock-profiles"

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

function aciertoPct(aciertos: number, total: number): string {
  if (total === 0) return "—"
  return Math.round((aciertos / total) * 100) + "%"
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k"
  return String(n)
}

// ── Badge ──────────────────────────────────────────────────────────────────────

interface BadgeColors { color: string; border: string; bg: string }

function badgeColors(nivel: BadgeLevel): BadgeColors {
  switch (nivel) {
    case "Quant":    return { color: "#A47FCA", border: "rgba(164,127,202,0.4)", bg: "rgba(164,127,202,0.12)" }
    case "Experto":  return { color: "var(--yellow)",    border: "rgba(240,192,64,0.4)",  bg: "rgba(240,192,64,0.10)" }
    case "Pro":      return { color: "var(--positive)",  border: "rgba(107,212,168,0.4)", bg: "rgba(107,212,168,0.10)" }
    case "Trader":   return { color: "var(--amber)",     border: "rgba(232,148,74,0.4)",  bg: "rgba(232,148,74,0.10)" }
    case "Analista": return { color: "var(--sky)",       border: "rgba(116,169,201,0.4)", bg: "rgba(116,169,201,0.10)" }
    case "Novato":   return { color: "var(--text-mute)", border: "var(--border-hi)",      bg: "transparent" }
  }
}

// ── ProfileCard ────────────────────────────────────────────────────────────────

export interface ProfileCardProps {
  profile: UserProfile
  onClick?: () => void
  compact?: boolean
}

export function ProfileCard({ profile, onClick, compact = false }: ProfileCardProps) {
  const badge = badgeColors(profile.nivel)
  const topN = compact ? 3 : 4
  const acciones = profile.topAcciones.slice(0, topN)

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick() } : undefined}
      style={{
        background: profile.isCurrentUser ? "var(--bg-elev-2)" : "var(--bg-elev)",
        border: `1px solid ${profile.isCurrentUser ? "var(--amber)" : "var(--border)"}`,
        borderLeft: profile.isCurrentUser ? "3px solid var(--amber)" : "1px solid var(--border)",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        outline: "none",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-hi)"
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          profile.isCurrentUser ? "var(--amber)" : "var(--border)"
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 12px 10px" }}>
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: profile.avatarBg,
          border: "1px solid var(--border-hi)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "var(--text)",
          fontFamily: "var(--font-ui)", flexShrink: 0,
          letterSpacing: 0.5,
        }}>
          {initials(profile.nombre)}
        </div>

        {/* Name block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
              {profile.nombre}
            </span>
            {/* Badge */}
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: 0.8,
              textTransform: "uppercase",
              color: badge.color, background: badge.bg,
              border: `1px solid ${badge.border}`,
              padding: "1px 6px", borderRadius: 3,
              whiteSpace: "nowrap",
            }}>
              {profile.nivel}
            </span>
            {profile.isCurrentUser && (
              <span style={{
                fontSize: 8, color: "var(--amber)", fontFamily: "var(--font-data)",
                letterSpacing: 0.5, opacity: 0.8,
              }}>
                vos
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
            <span style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
              @{profile.handle}
            </span>
            {profile.linkedin && (
              <a
                href={profile.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="LinkedIn"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  color: "var(--sky)", fontSize: 9, textDecoration: "none",
                }}
              >
                <ExternalLink size={10} />
                <span>LinkedIn</span>
              </a>
            )}
          </div>
        </div>

        {/* Streak */}
        {profile.streak >= 5 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--amber)", fontWeight: 700 }}>
              {profile.streak}d
            </div>
            <div style={{ fontSize: 8, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5 }}>racha</div>
          </div>
        )}
      </div>

      {/* ── Bio ── */}
      <div style={{
        padding: "0 12px 10px",
        fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5,
        display: "-webkit-box",
        WebkitLineClamp: compact ? 2 : 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {profile.bio}
      </div>

      {/* ── Top Acciones (conviction bars) ── */}
      {acciones.length > 0 && (
        <div style={{ padding: "8px 12px 10px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 8, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
            Top acciones
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {acciones.map((a) => (
              <div key={a.ticker} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "var(--amber)",
                  fontFamily: "var(--font-data)", minWidth: 38,
                }}>
                  {a.ticker}
                </span>
                <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 2 }}>
                  <div style={{
                    width: `${a.conviccion}%`, height: "100%",
                    background: a.conviccion >= 75 ? "var(--positive)" : a.conviccion >= 50 ? "var(--amber)" : "var(--text-dim)",
                    borderRadius: 2,
                  }} />
                </div>
                <span style={{
                  fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)",
                  minWidth: 26, textAlign: "right",
                }}>
                  {a.conviccion}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Intereses ── */}
      {!compact && profile.intereses.length > 0 && (
        <div style={{ padding: "8px 12px 10px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {profile.intereses.slice(0, 4).map((tag) => (
              <span key={tag} style={{
                fontSize: 9, color: "var(--text-dim)",
                background: "var(--bg-elev-2)", border: "1px solid var(--border-hi)",
                borderRadius: 99, padding: "2px 8px",
                fontFamily: "var(--font-ui)",
              }}>
                {tag}
              </span>
            ))}
            {profile.intereses.length > 4 && (
              <span style={{ fontSize: 9, color: "var(--text-mute)", padding: "2px 4px" }}>
                +{profile.intereses.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        borderTop: "1px solid var(--border)",
        background: "var(--bg)",
      }}>
        {[
          { label: "Posts",    value: fmtNum(profile.stats.posts) },
          { label: "Seguid.",  value: fmtNum(profile.stats.seguidores) },
          { label: "Aciertos", value: aciertoPct(profile.stats.aciertos, profile.stats.totalPrediciones) },
          { label: "Pts",      value: profile.stats.puntos.toLocaleString("es-AR") },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: "7px 0",
            textAlign: "center",
            borderRight: i < 3 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, fontFamily: "var(--font-data)",
              color: s.label === "Pts" ? "var(--amber)" : "var(--text)",
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: 8, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
