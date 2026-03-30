"use client"

import { useState } from "react"

interface Channel {
  id:      string
  label:   string
  country: string
  videoId: string
}

const CHANNELS: Channel[] = [
  { id: "tn",        label: "TN",        country: "AR", videoId: "cb12KmMMDJA" },
  { id: "cnn",       label: "CNN",       country: "US", videoId: "iDd-K24d7Fg" },
  { id: "france24",  label: "FRANCE 24", country: "FR", videoId: "Ap-UM1O9RBU" },
  { id: "aljazeera", label: "AL JAZEERA",country: "ME", videoId: "gCNeDWCI0vo" },
]

export function LiveSection() {
  const [activeId, setActiveId]   = useState<string>("tn")
  const [collapsed, setCollapsed] = useState(false)

  const active = CHANNELS.find((c) => c.id === activeId)

  return (
    <div style={{ borderBottom: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div
        className="bbg-panel-header"
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: activeId ? "#FF433D" : "#555",
            display: "inline-block",
            boxShadow: activeId ? "0 0 6px #FF433D" : "none",
          }}
        />
        NOTICIAS EN VIVO
        <span style={{ marginLeft: "auto", color: "#333", fontSize: 9, fontWeight: 400 }}>
          {collapsed ? "▼ EXPANDIR" : "▲ COLAPSAR"}
        </span>
      </div>

      {!collapsed && (
        <>
          {/* Channel tabs */}
          <div style={{ display: "flex", gap: 1, background: "#0a0a0a", padding: "4px 8px", overflowX: "auto" }}>
            {CHANNELS.map((ch) => {
              const isActive = activeId === ch.id
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveId(ch.id)}
                  style={{
                    padding: "4px 14px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    border: "1px solid",
                    borderColor: isActive ? "#FF433D" : "#222",
                    background: isActive ? "#1a0000" : "transparent",
                    color: isActive ? "#FF433D" : "#555",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {isActive && (
                    <span style={{ marginRight: 5, color: "#FF433D", fontSize: 8 }}>●</span>
                  )}
                  {ch.label}
                  <span style={{ marginLeft: 6, fontSize: 8, color: isActive ? "#FF433D88" : "#333" }}>
                    {ch.country}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Iframe — solo carga si hay canal activo */}
          {active && (
            <div style={{ position: "relative", paddingBottom: "42%", height: 0, background: "#050505" }}>
              <iframe
                key={active.videoId}
                src={`https://www.youtube.com/embed/${active.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&vq=hd720`}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                title={active.label}
              />
            </div>
          )}

        </>
      )}
    </div>
  )
}
