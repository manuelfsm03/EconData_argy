"use client"

import { useState } from "react"

const CHANNELS = [
  { id: "tn",        label: "TN",         country: "AR", videoId: "cb12KmMMDJA" },
  { id: "cnn",       label: "CNN",        country: "US", videoId: "iDd-K24d7Fg" },
  { id: "france24",  label: "FRANCE 24",  country: "FR", videoId: "Ap-UM1O9RBU" },
  { id: "aljazeera", label: "AL JAZEERA", country: "ME", videoId: "gCNeDWCI0vo" },
  { id: "c5n",       label: "C5N",        country: "AR", videoId: "SF06Qy1Ct6Y" },
  { id: "dw",        label: "DW NEWS",    country: "DE", videoId: "LuKwFajn37U" },
  { id: "bbc",       label: "BBC NEWS",   country: "UK", videoId: "2thdi9qLqs8" },
  { id: "euronews",  label: "EURONEWS",   country: "EU", videoId: "pykpO5kQJ98" },
]

export function LiveSection() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ borderTop: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div
        className="bbg-panel-header"
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF433D", display: "inline-block", boxShadow: "0 0 6px #FF433D" }} />
        EN VIVO
        <span style={{ marginLeft: "auto", color: "#333", fontSize: 9, fontWeight: 400 }}>
          {collapsed ? "▼ EXPANDIR" : "▲ COLAPSAR"}
        </span>
      </div>

      {!collapsed && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 150px)", gap: 1, background: "#111" }}>
          {CHANNELS.map((ch) => (
            <div key={ch.id} style={{ position: "relative", background: "#000" }}>
              {/* Label overlay */}
              <div style={{
                position: "absolute", top: 0, left: 0, zIndex: 1,
                background: "#000000cc", padding: "2px 6px",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                color: "#FF433D", display: "flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF433D", display: "inline-block" }} />
                {ch.label}
                <span style={{ color: "#555", fontWeight: 400 }}>{ch.country}</span>
              </div>
              <iframe
                src={`https://www.youtube.com/embed/${ch.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&vq=hd720`}
                style={{ display: "block", width: "100%", height: 150, border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                title={ch.label}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
