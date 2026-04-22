"use client"

import { useState, useRef, useEffect, useCallback } from "react"

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ToolCallLog {
  tool:       string
  ok:         boolean
  latency_ms: number
}

interface Message {
  id:        string
  role:      "user" | "agent" | "error" | "system"
  text:      string
  toolCalls?: ToolCallLog[]
  modelUsed?: string
}

const MODELS = [
  { id: "haiku-4.5",    label: "Haiku 4.5"    },
  { id: "gemini-flash", label: "Gemini Flash"  },
]

const MAX_LEN = 500

const TOOL_LABELS: Record<string, string> = {
  get_dolar_bcra:    "dólar/bcra",
  get_macro:         "macro",
  get_ipc:           "ipc",
  get_deuda_fiscal:  "deuda/fiscal",
  get_mundo:         "mundo",
  get_noticias:      "noticias",
}

const LOADING_PHRASES = ["Consultando dashboard", "Analizando datos", "Armando respuesta"]

// ── Componente principal ──────────────────────────────────────────────────────

export function ChatAgente() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:   "welcome",
      role: "agent",
      text: "Preguntame sobre dólar, inflación, macro, mercados globales o noticias del dashboard.",
    },
  ])
  const [input,       setInput]       = useState("")
  const [model,       setModel]       = useState("haiku-4.5")
  const [loading,     setLoading]     = useState(false)
  const [remaining,   setRemaining]   = useState<number | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || rateLimited) return

    setMessages((m) => [...m, { id: `u_${Date.now()}`, role: "user", text }])
    setInput("")
    setLoading(true)

    try {
      const res  = await fetch("/api/agente/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text, model }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setRateLimited(true)
        setMessages((m) => [...m, {
          id:   `s_${Date.now()}`,
          role: "system",
          text: "Llegaste al límite de 3 consultas diarias. Volvé mañana.",
        }])
        return
      }

      if (!res.ok) {
        setMessages((m) => [...m, {
          id:   `e_${Date.now()}`,
          role: "error",
          text: data?.error ?? "Error procesando la consulta.",
        }])
        return
      }

      setMessages((m) => [...m, {
        id:        `a_${Date.now()}`,
        role:      "agent",
        text:      data.answer,
        toolCalls: data.tool_calls,
        modelUsed: data.model_used,
      }])
      setRemaining(data.remaining)
      if (data.remaining === 0) setRateLimited(true)

    } catch {
      setMessages((m) => [...m, {
        id:   `e_${Date.now()}`,
        role: "error",
        text: "No pude conectar con el agente. Probá de nuevo.",
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, rateLimited, model])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const charsLeft = MAX_LEN - input.length

  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      height:        480,
      background:    "#08080a",
      border:        "1px solid #1a1a1a",
      borderRadius:  2,
      fontFamily:    "monospace",
      overflow:      "hidden",
    }}>
      {/* Header */}
      <div style={{
        display:        "flex",
        justifyContent: "space-between",
        alignItems:     "center",
        padding:        "8px 12px",
        borderBottom:   "1px solid #1a1a1a",
        background:     "#0a0a0c",
        flexShrink:     0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#FFA028", boxShadow: "0 0 6px #FFA02888",
          }} />
          <span style={{ fontSize: 10, color: "#888", letterSpacing: 1.5, textTransform: "uppercase" }}>
            Asistente
          </span>
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading}
          style={{
            fontSize:   9,
            background: "transparent",
            color:      "#555",
            border:     "1px solid #222",
            borderRadius: 2,
            padding:    "2px 6px",
            cursor:     "pointer",
            fontFamily: "monospace",
          }}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id} style={{ background: "#0a0a0c" }}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        style={{
          flex:       1,
          overflowY:  "auto",
          padding:    "12px 10px",
          display:    "flex",
          flexDirection: "column",
          gap:        8,
        }}
      >
        {messages.map((m) => <Bubble key={m.id} msg={m} />)}
        {loading && <LoadingBubble />}
      </div>

      {/* Footer / input */}
      <div style={{
        borderTop:   "1px solid #1a1a1a",
        padding:     "8px 10px",
        background:  "#0a0a0c",
        flexShrink:  0,
      }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={onKeyDown}
            placeholder={rateLimited ? "Límite alcanzado" : "¿Qué querés saber del mercado hoy?"}
            disabled={loading || rateLimited}
            rows={2}
            style={{
              flex:        1,
              background:  "#111",
              color:       "#ccc",
              border:      "1px solid #222",
              borderRadius: 2,
              padding:     "6px 8px",
              fontSize:    11,
              fontFamily:  "monospace",
              resize:      "none",
              outline:     "none",
              lineHeight:  1.4,
            }}
          />
          <button
            onClick={send}
            disabled={loading || rateLimited || !input.trim()}
            style={{
              background:   loading || rateLimited || !input.trim() ? "#111" : "#FFA028",
              color:        loading || rateLimited || !input.trim() ? "#444" : "#000",
              border:       "1px solid #222",
              borderRadius: 2,
              padding:      "8px 14px",
              fontSize:     14,
              fontFamily:   "monospace",
              cursor:       loading || rateLimited ? "default" : "pointer",
              fontWeight:   700,
              height:       52,
              transition:   "background 0.15s",
            }}
          >
            {loading ? "···" : "→"}
          </button>
        </div>
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          marginTop:      4,
          fontSize:       8,
          color:          "#333",
        }}>
          <span>{charsLeft < 100 ? `${charsLeft} caracteres restantes` : ""}</span>
          {remaining !== null && (
            <span>
              consultas restantes: <strong style={{ color: remaining > 0 ? "#555" : "#FF433D" }}>{remaining}/3</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  if (msg.role === "system") {
    return (
      <div style={{ textAlign: "center", fontSize: 9, color: "#555", padding: "4px 0" }}>
        {msg.text}
      </div>
    )
  }
  if (msg.role === "error") {
    return (
      <div style={{
        fontSize: 10, color: "#FF433D", background: "#1a0808",
        border: "1px solid #3a1010", borderRadius: 2, padding: "6px 10px",
      }}>
        ⚠ {msg.text}
      </div>
    )
  }
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          background:   "#1a1a2a",
          border:       "1px solid #2a2a3a",
          borderRadius: 2,
          padding:      "6px 10px",
          fontSize:     11,
          color:        "#ccc",
          maxWidth:     "78%",
          lineHeight:   1.5,
        }}>
          {msg.text}
        </div>
      </div>
    )
  }
  // agent
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "90%" }}>
      <div style={{
        background:   "#0e0e14",
        border:       "1px solid #1e1e2a",
        borderRadius: 2,
        padding:      "8px 12px",
        fontSize:     11,
        color:        "#bbb",
        lineHeight:   1.6,
      }}>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
      </div>
      {(msg.toolCalls?.length || msg.modelUsed) && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {msg.modelUsed && (
            <Tag label={msg.modelUsed === "haiku-4.5" ? "Haiku" : "Gemini"} color="#444" />
          )}
          {msg.toolCalls?.map((tc, i) => (
            <Tag
              key={i}
              label={TOOL_LABELS[tc.tool] ?? tc.tool}
              color={tc.ok ? "#1a2a1a" : "#2a1a1a"}
              textColor={tc.ok ? "#4AF6C3" : "#FF433D"}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Tag({ label, color, textColor }: { label: string; color: string; textColor?: string }) {
  return (
    <span style={{
      fontSize:     8,
      padding:      "2px 6px",
      background:   color,
      color:        textColor ?? "#666",
      borderRadius: 2,
      fontFamily:   "monospace",
      letterSpacing: 0.5,
    }}>
      {label}
    </span>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────────

function LoadingBubble() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % LOADING_PHRASES.length), 1200)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{
      background: "#0e0e14", border: "1px solid #1e1e2a", borderRadius: 2,
      padding: "8px 12px", fontSize: 10, color: "#555",
      display: "flex", alignItems: "center", gap: 8, maxWidth: "60%",
    }}>
      {LOADING_PHRASES[idx]}
      <Dots />
    </div>
  )
}

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: "50%", background: "#FFA028",
          animation: `dot-pulse 1.2s ${i * 0.2}s infinite`,
          display: "inline-block",
        }} />
      ))}
      <style>{`
        @keyframes dot-pulse {
          0%,80%,100% { opacity: 0.2; transform: scale(0.8); }
          40%          { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </span>
  )
}

// ── Markdown mínimo ───────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  if (!text) return ""
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" style="color:#4AF6C3">$1</a>')
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/\n/g, "<br/>")
  return html
}
