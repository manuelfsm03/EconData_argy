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

function extractVideoId(input: string): string | null {
  const s = input.trim()
  // youtu.be/ID
  const short = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  // watch?v=ID
  const watch = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watch) return watch[1]
  // embed/ID or live/ID
  const embed = s.match(/(?:embed|live)\/([a-zA-Z0-9_-]{11})/)
  if (embed) return embed[1]
  // raw ID de 11 caracteres
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  return null
}

export function LiveSection() {
  const [channels, setChannels]     = useState(DEFAULT_CHANNELS)
  const [collapsed, setCollapsed]   = useState(true)
  const [muted, setMuted]           = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_CHANNELS.map((c) => [c.id, true]))
  )
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})

  // Editor de canal personalizado
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
    <div style={{ borderTop: "1px solid #1a1a1a" }}>
      {/* Header */}
      <div
        className="bbg-panel-header"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF433D", display: "inline-block", boxShadow: "0 0 6px #FF433D" }} />
        EN VIVO
      </div>

      <>
          {/* Grid de canales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 150px)", gap: 1, background: "#111" }}>
            {channels.map((ch, idx) => (
              <div key={ch.id + ch.videoId} style={{ position: "relative", background: "#000" }}>
                {/* Label + mute button */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, zIndex: 1,
                  background: "#000000bb", padding: "2px 6px",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ fontSize: 9, color: "#555", flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#FF433D", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "#FF433D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.label}</span>
                  <span style={{ fontSize: 9, color: "#555" }}>{ch.country}</span>
                  <button
                    onClick={() => toggleMute(ch.id)}
                    title={muted[ch.id] ? "Activar audio" : "Silenciar"}
                    style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: 11, lineHeight: 1, color: muted[ch.id] ? "#555" : "#4AF6C3" }}
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

          {/* Editor de canal */}
          <div style={{ background: "#050505", borderTop: "1px solid #1a1a1a", padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Reemplazar canal</span>

            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              style={{ background: "#0a0a0a", border: "1px solid #222", color: "#888", fontSize: 9, padding: "2px 6px" }}
            >
              {channels.map((ch, i) => (
                <option key={ch.id} value={i}>{i + 1} — {ch.label}</option>
              ))}
            </select>

            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="URL o ID de YouTube"
              style={{ flex: 1, minWidth: 160, background: "#0a0a0a", border: "1px solid #222", color: "#ccc", fontSize: 9, padding: "3px 8px" }}
            />

            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Nombre (opcional)"
              style={{ width: 110, background: "#0a0a0a", border: "1px solid #222", color: "#ccc", fontSize: 9, padding: "3px 8px" }}
            />

            <button
              onClick={handleReplace}
              style={{ background: "#0d0d0d", border: "1px solid #333", color: "#FFA028", fontSize: 9, padding: "3px 10px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}
            >
              Aplicar
            </button>

            {error && <span style={{ fontSize: 9, color: "#FF433D" }}>{error}</span>}
          </div>
      </>
    </div>
  )
}
