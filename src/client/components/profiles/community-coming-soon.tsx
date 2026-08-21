"use client"

import { useState } from "react"
import { Trophy, Target, Flame, Lock } from "lucide-react"

// ── Datos del preview (anonimizados) ─────────────────────────────────────────

const PREVIEW_ROWS = [
  { rank: 1, alias: "Analista #1",  nivel: "Quant",    puntos: "12.400", pct: "81%", streak: "34d", color: "#FFD700" },
  { rank: 2, alias: "Pro #3",       nivel: "Experto",  puntos: "9.850",  pct: "76%", streak: "21d", color: "#C0C0C0" },
  { rank: 3, alias: "Trader #7",    nivel: "Pro",      puntos: "8.100",  pct: "69%", streak: "15d", color: "#CD7F32" },
  { rank: 4, alias: "Analista #2",  nivel: "Trader",   puntos: "6.730",  pct: "63%", streak: "9d",  color: "var(--text-mute)" },
  { rank: 5, alias: "Novato #12",   nivel: "Analista", puntos: "4.210",  pct: "55%", streak: "5d",  color: "var(--text-mute)" },
]

const FEATURES = [
  {
    icon: Trophy,
    title: "Rankings semanales",
    desc: "Competí cada semana por el top del leaderboard. Los mejores analistas del mercado, rankeados por predicciones y calidad de análisis.",
    color: "var(--amber)",
  },
  {
    icon: Target,
    title: "Predicciones con track record",
    desc: "Publicá tus tesis, y el sistema las sigue. Tu porcentaje de acierto queda público y construye tu reputación.",
    color: "var(--positive)",
  },
  {
    icon: Flame,
    title: "Badges y niveles",
    desc: "De Novato a Quant. Ganá puntos por análisis, streak diario, y precisión. Los badges se muestran en tu perfil.",
    color: "#A47FCA",
  },
]

// ── Badge de nivel ────────────────────────────────────────────────────────────

function nivelColor(nivel: string): string {
  switch (nivel) {
    case "Quant":    return "#A47FCA"
    case "Experto":  return "var(--yellow)"
    case "Pro":      return "var(--positive)"
    case "Trader":   return "var(--amber)"
    case "Analista": return "var(--sky)"
    default:         return "var(--text-mute)"
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CommunityComingSoon() {
  const [email, setEmail]       = useState("")
  const [notified, setNotified] = useState(false)

  function handleNotify() {
    if (!email.trim()) return
    // Sin backend: log + estado local
    console.log("[La Pizarra] Email pre-registro comunidad:", email)
    setNotified(true)
  }

  return (
    <div
      style={{
        background: "var(--bg)",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 16px 64px",
        gap: 40,
      }}
    >
      {/* ── Header ── */}
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
          <Trophy size={22} color="var(--amber)" />
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "var(--text)",
              letterSpacing: -0.5,
            }}
          >
            Comunidad La Pizarra
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              background: "var(--amber)",
              color: "#000",
              borderRadius: 4,
              padding: "2px 7px",
            }}
          >
            MUY PRONTO
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, margin: 0 }}>
          Un espacio para los que siguen el mercado en serio. Rankings, predicciones públicas
          con track record y badges que construyen reputación.
        </p>
      </div>

      {/* ── Feature cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          width: "100%",
          maxWidth: 720,
        }}
      >
        {FEATURES.map(({ icon: Icon, title, desc, color }) => (
          <div
            key={title}
            style={{
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "18px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon size={16} color={color} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{title}</span>
            </div>
            <p style={{ fontSize: 11, color: "var(--text-mute)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Leaderboard preview ── */}
      <div style={{ width: "100%", maxWidth: 620 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            padding: "0 2px",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", letterSpacing: 0.3 }}>
            Preview · Leaderboard Semanal
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <Lock size={11} color="var(--text-mute)" />
          <span style={{ fontSize: 10, color: "var(--text-mute)" }}>Datos anonimizados</span>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            background: "var(--bg-elev)",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "36px 1fr 80px 72px 52px 44px",
              padding: "6px 14px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg)",
            }}
          >
            {["#", "Analista", "Nivel", "Puntos", "Acierto", "Racha"].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  color: "var(--text-mute)",
                  textAlign: h === "#" ? "center" : h === "Analista" ? "left" : "right",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {PREVIEW_ROWS.map((row) => (
            <div
              key={row.rank}
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 80px 72px 52px 44px",
                padding: "9px 14px",
                borderBottom: "1px solid var(--border)",
                alignItems: "center",
                opacity: row.rank > 3 ? 0.55 : 1,
                filter: row.rank > 3 ? "blur(1.5px)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  textAlign: "center",
                  fontFamily: "var(--font-data)",
                  color: row.color,
                }}
              >
                {row.rank}
              </span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{row.alias}</div>
                <div style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
                  @???
                </div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: nivelColor(row.nivel),
                  textAlign: "right",
                }}
              >
                {row.nivel}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-data)",
                  color: "var(--amber)",
                  textAlign: "right",
                }}
              >
                {row.puntos}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-data)",
                  color: "var(--positive)",
                  textAlign: "right",
                }}
              >
                {row.pct}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-data)",
                  color: "var(--text-dim)",
                  textAlign: "right",
                }}
              >
                {row.streak}
              </span>
            </div>
          ))}

          {/* "Unlock" hint */}
          <div
            style={{
              padding: "10px 14px",
              textAlign: "center",
              fontSize: 10,
              color: "var(--text-mute)",
              fontStyle: "italic",
            }}
          >
            Los rankings completos se revelan con el lanzamiento
          </div>
        </div>
      </div>

      {/* ── Email pre-registro ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-elev)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "22px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          Sé el primero en entrar
        </span>
        <span style={{ fontSize: 11, color: "var(--text-mute)", lineHeight: 1.5 }}>
          Dejá tu email y te avisamos cuando abramos la beta.
        </span>

        {notified ? (
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--positive)",
              padding: "10px 0",
            }}
          >
            ✓ Te avisamos cuando abramos
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNotify()}
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: 12,
                borderRadius: 7,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                outline: "none",
              }}
            />
            <button
              onClick={handleNotify}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                background: "var(--amber)",
                color: "#000",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Notificarme
            </button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <p style={{ fontSize: 10, color: "var(--text-mute)", textAlign: "center", margin: 0 }}>
        Beta abierta próximamente · La Pizarra 2026
      </p>
    </div>
  )
}
