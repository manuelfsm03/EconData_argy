"use client"

import { useState, useRef } from "react"

const CHANNELS = [
  { id: "tn",        label: "TN",         country: "AR", videoId: "cb12KmMMDJA" },
  { id: "abc",       label: "ABC NEWS",   country: "US", videoId: "BC3LInervmo" },
  { id: "france24",  label: "FRANCE 24",  country: "FR", videoId: "Ap-UM1O9RBU" },
  { id: "aljazeera", label: "AL JAZEERA", country: "ME", videoId: "gCNeDWCI0vo" },
  { id: "c5n",       label: "C5N",        country: "AR", videoId: "SF06Qy1Ct6Y" },
  { id: "dw",        label: "DW NEWS",    country: "DE", videoId: "LuKwFajn37U" },
  { id: "skynews",   label: "SKY NEWS",   country: "UK", videoId: "76zNJpupnqs" },
  { id: "euronews",  label: "EURONEWS",   country: "EU", videoId: "pykpO5kQJ98" },
]

export function LiveSection() {
  const [collapsed, setCollapsed]   = useState(false)
  const [muted, setMuted]           = useState<Record<string, boolean>>(
    Object.fromEntries(CHANNELS.map((c) => [c.id, true]))
  )
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  const toggleMute = (id: string) => {
    const isMuted = muted[id]
    const iframe  = iframeRefs.current[id]
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: isMuted ? "unMute" : "mute", args: [] }),
        "*"
      )
    }
    setMuted((prev) => ({ ...prev, [id]: !isMuted }))
  }

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

              {/* Label + mute button overlay */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, zIndex: 1,
                background: "#000000bb", padding: "2px 6px",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF433D", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "#FF433D" }}>{ch.label}</span>
                <span style={{ fontSize: 9, color: "#555" }}>{ch.country}</span>
                <button
                  onClick={() => toggleMute(ch.id)}
                  title={muted[ch.id] ? "Activar audio" : "Silenciar"}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 2px",
                    fontSize: 11,
                    lineHeight: 1,
                    color: muted[ch.id] ? "#555" : "#4AF6C3",
                  }}
                >
                  {muted[ch.id] ? "🔇" : "🔊"}
                </button>
              </div>

              <iframe
                ref={(el) => { iframeRefs.current[ch.id] = el }}
                src={`https://www.youtube.com/embed/${ch.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&vq=hd720&enablejsapi=1`}
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
