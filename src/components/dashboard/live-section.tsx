"use client"

import { useState, useRef } from "react"

const DEFAULT_CHANNELS = [
  { id: "tn",        label: "TN",         country: "AR", videoId: "cb12KmMMDJA" },
  { id: "abc",       label: "ABC NEWS",   country: "US", videoId: "BC3LInervmo" },
  { id: "france24",  label: "FRANCE 24",  country: "FR", videoId: "Ap-UM1O9RBU" },
  { id: "aljazeera", label: "AL JAZEERA", country: "ME", videoId: "gCNeDWCI0vo" },
  { id: "c5n",       label: "C5N",        country: "AR", videoId: "SF06Qy1Ct6Y" },
  { id: "dw",        label: "DW NEWS",    country: "DE", videoId: "LuKwFajn37U" },
  { id: "skynews",   label: "SKY NEWS",   country: "UK", videoId: "76zNJpupnqs" },
  { id: "euronews",  label: "EURONEWS",   country: "EU", videoId: "pykpO5kQJ98" },
]

// Altura de cada tile en modo compacto (preview visible pero no invasivo)
const TILE_H = 90

function extractVideoId(input: string): string | null {
  const s = input.trim()
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  const watch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watch) return watch[1]
  const embed = s.match(/(?:embed|live)\/([a-zA-Z0-9_-]{11})/)
  if (embed) return embed[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return null
}

export function LiveSection() {
  const [channels, setChannels] = useState(DEFAULT_CHANNELS)
  const [hidden, setHidden]     = useState(false) // false = visible por defecto
  const [muted, setMuted]       = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_CHANNELS.map((c) => [c.id, true]))
  )
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  const [selectedSlot, setSelectedSlot] = useState("0")
  const [urlInput, setUrlInput]         = useState("")
  const [labelInput, setLabelInput]     = useState("")
  const [error, setError]               = useState("")

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

  const handleReplace = () => {
    setError("")
    const videoId = extractVideoId(urlInput)
    if (!videoId) { setError("URL o ID inválido"); return }
    const idx   = parseInt(selectedSlot)
    const label = labelInput.trim() || channels[idx].label
    setChannels((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], label: label.toUpperCase(), videoId }
      return next
    })
    setUrlInput("")
    setLabelInput("")
  }

  return (
    <div style={{ borderTop: "1px solid #1a1a1a", flexShrink: 0 }}>
      {/* Header — siempre visible */}
      <div
        className="bbg-panel-header"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setHidden((v) => !v)}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#FF433D", display: "inline-block",
          boxShadow: "0 0 5px #FF433D55",
        }} />
        <span style={{ color: "#FF433D", fontSize: 10, letterSpacing: 1 }}>EN VIVO</span>
        <span style={{ fontSize: 9, color: "#444" }}>— {channels.length} canales</span>

        <span style={{
          marginLeft: "auto",
          fontSize: 9, color: "#555", fontWeight: 400,
          background: "#0d0d0d", border: "1px solid #1e1e1e",
          padding: "1px 8px", borderRadius: 10, fontFamily: "monospace",
        }}>
          {hidden ? "▶ mostrar" : "▼ ocultar"}
        </span>
      </div>

      {/* Canales — grilla 8 en una fila, compactos */}
      {!hidden && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 1,
            background: "#0a0a0a",
          }}>
            {channels.map((ch, idx) => (
              <div key={ch.id + ch.videoId} style={{ position: "relative", background: "#000", height: TILE_H }}>
                {/* Overlay con label y mute */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
                  background: "linear-gradient(to bottom, #000000cc 0%, transparent 100%)",
                  padding: "3px 5px",
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                  <span style={{ fontSize: 8, color: "#555", flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#FF433D", display: "inline-block", flexShrink: 0 }} />
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: "#ccc",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                  }}>
                    {ch.label}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(ch.id) }}
                    title={muted[ch.id] ? "Activar audio" : "Silenciar"}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      padding: 0, fontSize: 9, lineHeight: 1,
                      color: muted[ch.id] ? "#444" : "#4AF6C3",
                      flexShrink: 0,
                    }}
                  >
                    {muted[ch.id] ? "🔇" : "🔊"}
                  </button>
                </div>

                <iframe
                  ref={(el) => { iframeRefs.current[ch.id] = el }}
                  src={`https://www.youtube.com/embed/${ch.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1`}
                  style={{ display: "block", width: "100%", height: TILE_H, border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="lazy"
                  title={ch.label}
                />
              </div>
            ))}
          </div>

          {/* Editor de canal */}
          <div style={{
            background: "#050505", borderTop: "1px solid #111",
            padding: "5px 10px", display: "flex", alignItems: "center",
            gap: 8, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 8, color: "#333", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
              Reemplazar canal
            </span>

            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", color: "#666", fontSize: 8, padding: "2px 4px" }}
            >
              {channels.map((ch, i) => (
                <option key={ch.id} value={i}>{i + 1} — {ch.label}</option>
              ))}
            </select>

            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="URL o ID de YouTube"
              style={{ flex: 1, minWidth: 140, background: "#0a0a0a", border: "1px solid #1a1a1a", color: "#aaa", fontSize: 8, padding: "2px 6px" }}
            />

            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Nombre (opcional)"
              style={{ width: 90, background: "#0a0a0a", border: "1px solid #1a1a1a", color: "#aaa", fontSize: 8, padding: "2px 6px" }}
            />

            <button
              onClick={handleReplace}
              style={{
                background: "#0d0d0d", border: "1px solid #222", color: "#FFA028",
                fontSize: 8, padding: "2px 8px", cursor: "pointer",
                textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
              }}
            >
              Aplicar
            </button>

            {error && <span style={{ fontSize: 8, color: "#FF433D" }}>{error}</span>}
          </div>
        </>
      )}
    </div>
  )
}
