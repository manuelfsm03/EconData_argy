"use client"

import { ChevronDown, ChevronRight, Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type Channel = { id: string; label: string; country: string; videoId: string }

const DEFAULT_CHANNELS: Channel[] = [
  { id: "tn", label: "TN", country: "AR", videoId: "cb12KmMMDJA" },
  { id: "abc", label: "ABC NEWS", country: "US", videoId: "BC3LInervmo" },
  { id: "france24", label: "FRANCE 24", country: "FR", videoId: "Ap-UM1O9RBU" },
  { id: "aljazeera", label: "AL JAZEERA", country: "ME", videoId: "gCNeDWCI0vo" },
  { id: "c5n", label: "C5N", country: "AR", videoId: "SF06Qy1Ct6Y" },
  { id: "dw", label: "DW NEWS", country: "DE", videoId: "LuKwFajn37U" },
  { id: "skynews", label: "SKY NEWS", country: "UK", videoId: "76zNJpupnqs" },
  { id: "euronews", label: "EURONEWS", country: "EU", videoId: "pykpO5kQJ98" },
]

// Los canales customizados se guardan en el navegador para sobrevivir refresh
const STORAGE_KEY = "lapizarra:live-channels"

function persistChannels(list: Channel[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch { /* storage lleno o bloqueado */ }
}

const TILE_HEIGHT = 90

function extractVideoId(input: string): string | null {
  const value = input.trim()
  const short = value.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  const watch = value.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watch) return watch[1]
  const embed = value.match(/(?:embed|live)\/([a-zA-Z0-9_-]{11})/)
  if (embed) return embed[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value
  return null
}

export function LiveSection() {
  const [channels, setChannels] = useState(DEFAULT_CHANNELS)
  const [hidden, setHidden] = useState(false)
  const [muted, setMuted] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_CHANNELS.map((channel) => [channel.id, true])),
  )
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})
  const [selectedSlot, setSelectedSlot] = useState("0")
  const [urlInput, setUrlInput] = useState("")
  const [labelInput, setLabelInput] = useState("")
  const [error, setError] = useState("")

  // Hidratar canales guardados (en useEffect para no romper el render del server)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0 &&
          parsed.every((c) => c && typeof c.id === "string" && typeof c.videoId === "string" && typeof c.label === "string")) {
        setChannels(parsed as Channel[])
      }
    } catch { /* json inválido → ignorar y usar defaults */ }
  }, [])

  const toggleMute = (id: string) => {
    const isMuted = muted[id]
    const iframe = iframeRefs.current[id]
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: isMuted ? "unMute" : "mute", args: [] }),
        "https://www.youtube.com",
      )
    }
    setMuted((previous) => ({ ...previous, [id]: !isMuted }))
  }

  const handleReplace = () => {
    setError("")
    const videoId = extractVideoId(urlInput)
    if (!videoId) {
      setError("URL o ID inválido")
      return
    }
    const index = Number.parseInt(selectedSlot, 10)
    const label = labelInput.trim() || channels[index].label
    const next = [...channels]
    next[index] = { ...next[index], label: label.toUpperCase(), videoId }
    setChannels(next)
    persistChannels(next)  // guardar para que sobreviva al refresh
    setUrlInput("")
    setLabelInput("")
  }

  return (
    <section style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
      <button
        type="button"
        className="bbg-panel-header"
        onClick={() => setHidden((value) => !value)}
        aria-expanded={!hidden}
        aria-controls="live-news-channels"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          border: 0,
          borderBottom: hidden ? 0 : "1px solid var(--border)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--negative)",
            boxShadow: "0 0 5px color-mix(in srgb, var(--negative) 45%, transparent)",
          }}
        />
        <span style={{ color: "var(--negative)", fontSize: 10, letterSpacing: 1 }}>EN VIVO</span>
        <span style={{ color: "var(--text-mute)", fontSize: 9, fontWeight: 400 }}>
          {channels.length} canales
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginLeft: "auto",
            color: "var(--text-dim)",
            fontSize: 9,
            fontWeight: 400,
          }}
        >
          {hidden ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
          {hidden ? "MOSTRAR" : "OCULTAR"}
        </span>
      </button>

      {!hidden && (
        <div id="live-news-channels">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 1,
              background: "var(--bg-elev-2)",
            }}
          >
            {channels.map((channel, index) => (
              <div
                key={`${channel.id}-${channel.videoId}`}
                style={{ position: "relative", height: TILE_HEIGHT, background: "var(--bg)" }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 5px",
                    background: "linear-gradient(to bottom, #000000dd, transparent)",
                  }}
                >
                  <span style={{ color: "#777", fontSize: 8 }}>{index + 1}</span>
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      color: "#ddd",
                      fontSize: 8,
                      fontWeight: 700,
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {channel.label}
                  </span>
                  <span style={{ color: "#777", fontSize: 8 }}>{channel.country}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleMute(channel.id)
                    }}
                    aria-label={`${muted[channel.id] ? "Activar" : "Silenciar"} audio de ${channel.label}`}
                    title={muted[channel.id] ? "Activar audio" : "Silenciar"}
                    style={{
                      display: "inline-flex",
                      marginLeft: "auto",
                      padding: 2,
                      border: 0,
                      background: "transparent",
                      color: muted[channel.id] ? "#777" : "var(--positive)",
                      cursor: "pointer",
                    }}
                  >
                    {muted[channel.id] ? <VolumeX size={11} aria-hidden="true" /> : <Volume2 size={11} aria-hidden="true" />}
                  </button>
                </div>
                <iframe
                  ref={(element) => {
                    iframeRefs.current[channel.id] = element
                  }}
                  src={`https://www.youtube.com/embed/${channel.videoId}?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1`}
                  style={{ display: "block", width: "100%", height: TILE_HEIGHT, border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="lazy"
                  title={channel.label}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              padding: "5px 10px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg)",
            }}
          >
            <span style={{ color: "var(--text-mute)", fontSize: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Reemplazar canal
            </span>
            <select
              value={selectedSlot}
              onChange={(event) => setSelectedSlot(event.target.value)}
              aria-label="Canal a reemplazar"
              style={{ padding: "2px 4px", border: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--text-dim)", fontSize: 8 }}
            >
              {channels.map((channel, index) => (
                <option key={channel.id} value={index}>{index + 1} — {channel.label}</option>
              ))}
            </select>
            <input
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="URL o ID de YouTube"
              aria-label="URL o ID de YouTube"
              style={{ flex: 1, minWidth: 140, padding: "2px 6px", border: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--text)", fontSize: 8 }}
            />
            <input
              value={labelInput}
              onChange={(event) => setLabelInput(event.target.value)}
              placeholder="Nombre (opcional)"
              aria-label="Nombre del canal"
              style={{ width: 110, padding: "2px 6px", border: "1px solid var(--border)", background: "var(--bg-elev)", color: "var(--text)", fontSize: 8 }}
            />
            <button
              type="button"
              onClick={handleReplace}
              style={{ padding: "2px 8px", border: "1px solid var(--border-hi)", background: "var(--bg-elev-2)", color: "var(--amber)", cursor: "pointer", fontSize: 8 }}
            >
              APLICAR
            </button>
            {error && <span role="alert" style={{ color: "var(--negative)", fontSize: 8 }}>{error}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
