"use client"

import { useState } from "react"
import { Trophy, Zap, TrendingUp, Target } from "lucide-react"
import {
  MOCK_PROFILES,
  CURRENT_USER,
  nextLevel,
  profileCompleteness,
  type UserProfile,
  type BadgeLevel,
} from "./mock-profiles"
import { ProfileCard } from "./profile-card"
import { ProfileDetail } from "./profile-detail"

// ── Helpers ───────────────────────────────────────────────────────────────────

function aciertoPct(aciertos: number, total: number): number {
  if (total === 0) return 0
  return Math.round((aciertos / total) * 100)
}

function badgeColor(nivel: BadgeLevel): string {
  switch (nivel) {
    case "Quant":    return "#A47FCA"
    case "Experto":  return "var(--yellow)"
    case "Pro":      return "var(--positive)"
    case "Trader":   return "var(--amber)"
    case "Analista": return "var(--sky)"
    case "Novato":   return "var(--text-mute)"
  }
}

const LEADERBOARD_SIZE = 5

function proximoDomingo(): string {
  const d = new Date()
  const dow = d.getDay() // 0 = domingo
  const diasHastaDomingo = dow === 0 ? 7 : 7 - dow
  d.setDate(d.getDate() + diasHastaDomingo)
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })
}

const WEEKLY_CHALLENGE = {
  descripcion: "Publicá tu tesis sobre GD30 esta semana",
  puntosReward: 75,
  deadline: proximoDomingo(),
}

// ── GamificationBanner ────────────────────────────────────────────────────────

function GamificationBanner({ onOpenProfile, user: userProp }: { onOpenProfile: () => void; user?: UserProfile }) {
  const user = userProp ?? CURRENT_USER
  const completeness = profileCompleteness(user)
  const { nivel: nextLvl, ptsNecesarios } = nextLevel(user.nivel, user.stats.puntos)
  const ptsToNext = ptsNecesarios
  const nextPtsTotal = nextLvl
    ? user.stats.puntos + ptsNecesarios
    : user.stats.puntos
  const progressToNext = nextLvl
    ? Math.round(((nextPtsTotal - ptsNecesarios) / nextPtsTotal) * 100)
    : 100

  const ahora = new Date()
  const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000)
  const predsSemanales = (user.predicciones ?? []).filter(p => {
    if (p.estado === "abierta") return false
    const fechaRes = p.fechaResuelta ? new Date(p.fechaResuelta) : null
    return fechaRes != null && fechaRes >= hace7d && fechaRes <= ahora
  })
  const weeklyAciertos = predsSemanales.filter(p => p.estado === "acertada").length
  const weeklyTotal = predsSemanales.length

  // Qué le falta al perfil para completarse
  const missingItems: string[] = []
  if (!user.linkedin) missingItems.push("LinkedIn (+15 pts)")
  if (user.topAcciones.length < 5) missingItems.push(`${5 - user.topAcciones.length} activos más en cartera (+${(5 - user.topAcciones.length) * 5} pts)`)
  if (user.stats.posts < 20) missingItems.push("Publicar más análisis")

  return (
    <div style={{
      background: "var(--bg-elev)",
      borderBottom: "2px solid var(--amber)",
      padding: 0,
    }}>
      {/* Eyebrow */}
      <div style={{
        padding: "6px 14px",
        background: "var(--bg-elev-2)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>
          TU ACTIVIDAD EN LA COMUNIDAD
        </span>
        <span style={{ fontSize: 9, color: "var(--text-mute)" }}>·</span>
        <span style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
          @{user.handle}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onOpenProfile}
          style={{
            background: "none", border: "1px solid var(--border-hi)",
            color: "var(--text-dim)", fontSize: 9, padding: "2px 10px",
            cursor: "pointer", borderRadius: 3,
            textTransform: "uppercase", letterSpacing: 0.8,
          }}
        >
          Ver mi perfil completo
        </button>
      </div>

      {/* Four KPI panels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>

        {/* Panel 1: Posición + Puntos + Progreso al siguiente nivel */}
        <div style={{ padding: "12px 14px", borderRight: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <Trophy size={12} color="var(--amber)" />
            <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>
              Tu posición
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)", color: "var(--amber)" }}>
              {user.stats.puntos.toLocaleString("es-AR")}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-mute)" }}>pts</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 8 }}>
            {user.nivel}{" "}
            <span style={{ color: "var(--text-mute)", fontSize: 9 }}>
              #{MOCK_PROFILES.filter(p => p.stats.puntos > user.stats.puntos).length + 1} de {MOCK_PROFILES.length} analistas
            </span>
          </div>
          {nextLvl && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: "var(--text-mute)" }}>
                  Próximo nivel: <span style={{ color: badgeColor(nextLvl) }}>{nextLvl}</span>
                </span>
                <span style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
                  faltan {ptsToNext} pts
                </span>
              </div>
              <div style={{ height: 3, background: "var(--border)", borderRadius: 2 }}>
                <div style={{
                  width: `${progressToNext}%`, height: "100%", borderRadius: 2,
                  background: "var(--amber)", transition: "width 1s ease",
                }} />
              </div>
            </>
          )}
          {!nextLvl && (
            <div style={{ fontSize: 9, color: "var(--yellow)" }}>Nivel máximo alcanzado</div>
          )}
        </div>

        {/* Panel 2: Racha */}
        <div style={{ padding: "12px 14px", borderRight: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <Zap size={12} color={user.streak >= 10 ? "var(--amber)" : "var(--text-mute)"} />
            <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>
              Racha
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)", color: user.streak >= 10 ? "var(--amber)" : "var(--text)" }}>
              {user.streak}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-mute)" }}>días consecutivos</span>
          </div>
          {/* Mini-calendar dots: last 7 days */}
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const active = i >= (7 - Math.min(user.streak, 7))
              return (
                <div key={i} style={{
                  width: 14, height: 14, borderRadius: 2,
                  background: active ? "var(--amber)" : "var(--border)",
                  opacity: active ? (i === 6 ? 1 : 0.5 + (i / 7) * 0.5) : 1,
                }} />
              )
            })}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-mute)", marginTop: 5 }}>
            Esta semana: {weeklyAciertos} de {weeklyTotal} predicciones acertadas
          </div>
        </div>

        {/* Panel 3: Completitud del perfil */}
        <div style={{ padding: "12px 14px", borderRight: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <TrendingUp size={12} color="var(--positive)" />
            <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>
              Perfil completo
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)", color: completeness >= 80 ? "var(--positive)" : completeness >= 50 ? "var(--amber)" : "var(--negative)" }}>
              {completeness}%
            </span>
          </div>
          <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 8 }}>
            <div style={{
              width: `${completeness}%`, height: "100%", borderRadius: 2,
              background: completeness >= 80 ? "var(--positive)" : completeness >= 50 ? "var(--amber)" : "var(--negative)",
              transition: "width 1s ease",
            }} />
          </div>
          {missingItems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 9, color: "var(--text-mute)", marginBottom: 2 }}>Te falta:</div>
              {missingItems.slice(0, 2).map((item) => (
                <div key={item} style={{ fontSize: 9, color: "var(--amber)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--border-hi)" }}>›</span> {item}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 9, color: "var(--positive)" }}>Perfil completo. Excelente.</div>
          )}
        </div>

        {/* Panel 4: Reto de la semana */}
        <div style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <Target size={12} color="var(--sky)" />
            <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>
              Reto semanal
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 8 }}>
            {WEEKLY_CHALLENGE.descripcion}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{
              fontSize: 11, fontWeight: 700, fontFamily: "var(--font-data)",
              color: "var(--sky)",
              background: "rgba(116,169,201,0.1)",
              border: "1px solid rgba(116,169,201,0.3)",
              padding: "3px 9px", borderRadius: 3,
            }}>
              +{WEEKLY_CHALLENGE.puntosReward} pts
            </span>
            <span style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
              hasta el {WEEKLY_CHALLENGE.deadline}
            </span>
          </div>
          {(() => {
            const top2 = [...MOCK_PROFILES]
              .filter(p => !p.isCurrentUser)
              .sort((a, b) => b.stats.puntos - a.stats.puntos)
              .slice(0, 2)
            return (
              <div style={{ marginTop: 8, padding: "5px 8px", background: "var(--bg-elev-2)", borderRadius: 3 }}>
                <div style={{ fontSize: 9, color: "var(--text-mute)", marginBottom: 2 }}>Top analistas de la comunidad</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  {top2.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && " · "}
                      <span style={{ color: i === 0 ? "var(--amber)" : "var(--positive)", fontWeight: 700, fontFamily: "var(--font-data)" }}>
                        {p.handle}
                      </span>
                      {" "}{p.stats.puntos.toLocaleString("es-AR")} pts
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

      </div>
    </div>
  )
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

function Leaderboard({ onSelect }: { onSelect: (p: UserProfile) => void }) {
  const sorted = [...MOCK_PROFILES]
    .sort((a, b) => b.stats.puntos - a.stats.puntos)
    .slice(0, LEADERBOARD_SIZE)

  return (
    <div style={{ background: "var(--bg-elev)", borderBottom: "1px solid var(--border)" }}>
      <div style={{
        padding: "8px 14px",
        background: "var(--bg-elev-2)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Trophy size={12} color="var(--amber)" />
        <span style={{ fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>
          Ranking de la semana — top {LEADERBOARD_SIZE}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["#", "Usuario", "Nivel", "Puntos", "Aciertos", "Racha", "Posts"].map((h, i) => (
                <th key={h} style={{
                  padding: "5px 12px",
                  fontSize: 9, fontWeight: 500, color: "var(--text-mute)",
                  textAlign: i <= 1 ? "left" : "right",
                  textTransform: "uppercase", letterSpacing: 0.6,
                  background: "transparent",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const rank = idx + 1
              const pct = aciertoPct(p.stats.aciertos, p.stats.totalPrediciones)
              const isMe = p.isCurrentUser
              const rankColor = rank === 1 ? "var(--yellow)" : rank === 2 ? "var(--text-dim)" : rank === 3 ? "var(--amber)" : "var(--text-mute)"

              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  style={{
                    borderBottom: "1px solid var(--border-light)",
                    background: isMe ? "var(--amber-soft)" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isMe ? "rgba(232,148,74,0.2)" : "var(--bg-elev-2)" }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isMe ? "var(--amber-soft)" : "transparent" }}
                >
                  <td style={{ padding: "7px 12px", textAlign: "left" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-data)", color: rankColor }}>
                      {rank}
                    </span>
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "left" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{p.nombre}</div>
                    <div style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>@{p.handle}{isMe ? " · vos" : ""}</div>
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "right" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: badgeColor(p.nivel),
                    }}>
                      {p.nivel}
                    </span>
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 700, color: "var(--amber)" }}>
                    {p.stats.puntos.toLocaleString("es-AR")}
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "var(--font-data)", fontSize: 11, color: pct >= 75 ? "var(--positive)" : pct >= 55 ? "var(--text-dim)" : "var(--negative)" }}>
                    {pct > 0 ? `${pct}%` : "—"}
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "var(--font-data)", fontSize: 11, color: p.streak >= 20 ? "var(--amber)" : "var(--text-dim)" }}>
                    {p.streak}d
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-dim)" }}>
                    {p.stats.posts}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── CommunityView (main) ───────────────────────────────────────────────────────

export function CommunityView() {
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile>(CURRENT_USER)

  const openProfile = (p: UserProfile) => setSelectedProfile(p)
  const openCurrentUser = () => setSelectedProfile(currentUser)
  const closeProfile = () => setSelectedProfile(null)

  const handleProfileUpdated = (updated: UserProfile) => {
    if (updated.isCurrentUser) setCurrentUser(updated)
    setSelectedProfile(updated)
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100%", display: "flex", flexDirection: "column" }}>

      {/* ── Gamification Banner ── */}
      <GamificationBanner onOpenProfile={openCurrentUser} user={currentUser} />

      {/* ── Leaderboard ── */}
      <Leaderboard onSelect={openProfile} />

      {/* ── Section header ── */}
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>
          Comunidad
        </span>
        <span style={{ fontSize: 9, color: "var(--text-mute)" }}>—</span>
        <span style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
          {MOCK_PROFILES.length} analistas
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: "var(--text-mute)" }}>
          Click en un perfil para ver el detalle
        </span>
      </div>

      {/* ── Profile grid ── */}
      <div style={{
        padding: 12,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 10,
        alignItems: "start",
      }}>
        {MOCK_PROFILES.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            onClick={() => openProfile(profile)}
          />
        ))}
      </div>

      {/* ── Footer note ── */}
      <div style={{ padding: "8px 14px 16px", fontSize: 9, color: "var(--text-mute)" }}>
        Los perfiles, carteras y predicciones son declarados por los usuarios · No constituyen asesoramiento de inversión
      </div>

      {/* ── Profile detail drawer ── */}
      <ProfileDetail
        profile={selectedProfile}
        onClose={closeProfile}
        onUpdated={handleProfileUpdated}
      />
    </div>
  )
}
