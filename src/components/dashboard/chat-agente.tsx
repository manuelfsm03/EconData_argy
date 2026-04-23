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

const SUGGESTIONS = [
  "¿Cómo está el dólar hoy?",
  "¿Cuál es la inflación del último mes?",
  "Resumen de noticias económicas de hoy",
  "¿Cómo están los mercados globales?",
]

// ── Componente principal ──────────────────────────────────────────────────────

export function ChatAgente() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:   "welcome",
      role: "agent",
      text: "Soy Pizi, tu asistente de datos. Preguntame sobre dólar, inflación, macro, mercados globales o noticias del dashboard.",
    },
  ])
  const [input,        setInput]        = useState("")
  const [model,        setModel]        = useState("haiku-4.5")
  const [loading,      setLoading]      = useState(false)
  const [remaining,    setRemaining]    = useState<number | null>(null)
  const [rateLimited,  setRateLimited]  = useState(false)
  const [usedSuggestions, setUsedSuggestions] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const sendText = useCallback(async (text: string) => {
    if (!text || loading || rateLimited) return
    setUsedSuggestions(true)
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
          id:   `rl_${Date.now()}`,
          role: "system",
          text: "__RATE_LIMIT__",
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
  }, [loading, rateLimited, model])

  const send = useCallback(() => {
    const text = input.trim()
    if (text) sendText(text)
  }, [input, sendText])

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
            Pizi
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

      {/* Sugerencias — solo antes del primer envío */}
      {!usedSuggestions && !loading && !rateLimited && (
        <div style={{
          display:    "flex",
          flexWrap:   "wrap",
          gap:        4,
          padding:    "0 10px 8px",
          borderTop:  "1px solid #111",
        }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendText(s)}
              style={{
                fontSize:     9,
                padding:      "4px 8px",
                background:   "#0e0e14",
                color:        "#666",
                border:       "1px solid #222",
                borderRadius: 2,
                cursor:       "pointer",
                fontFamily:   "monospace",
                textAlign:    "left",
                lineHeight:   1.3,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

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
          {remaining !== null && remaining > 0 && (
            <span>
              consultas restantes: <strong style={{ color: "#555" }}>{remaining}/3</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Rate limit card ───────────────────────────────────────────────────────────

function RateLimitCard() {
  return (
    <div style={{
      background:   "#0a0a0e",
      border:       "1px solid #2a1a00",
      borderRadius: 4,
      padding:      "12px 14px",
      fontSize:     10,
    }}>
      <div style={{ color: "#FFA028", fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>
        LÍMITE DIARIO ALCANZADO
      </div>
      <div style={{ color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
        Usaste tus 3 consultas gratuitas de hoy.<br/>
        El límite se resetea a medianoche.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
          ¿Qué querés hacer?
        </div>
        {/* Opción 1: esperar */}
        <div style={{
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          padding:      "8px 10px",
          background:   "#0d0d0d",
          border:       "1px solid #1a1a1a",
          borderRadius: 3,
        }}>
          <span style={{ fontSize: 14 }}>🕛</span>
          <div>
            <div style={{ color: "#888", fontSize: 10, fontWeight: 600 }}>Esperar hasta mañana</div>
            <div style={{ color: "#444", fontSize: 9 }}>Gratis · 3 consultas/día · sin registro</div>
          </div>
        </div>
        {/* Opción 2: suscribirse */}
        <a
          href="/suscripcion"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          8,
            padding:      "8px 10px",
            background:   "linear-gradient(135deg, #1a0f00, #0d0a00)",
            border:       "1px solid #FFA028",
            borderRadius: 3,
            cursor:       "pointer",
            transition:   "border-color 0.15s",
          }}>
            <span style={{ fontSize: 14 }}>⚡</span>
            <div>
              <div style={{ color: "#FFA028", fontSize: 10, fontWeight: 700 }}>Colaborar con La Pizarra</div>
              <div style={{ color: "#7a5a20", fontSize: 9 }}>Consultas ilimitadas · acceso anticipado a nuevas funciones</div>
            </div>
          </div>
        </a>
      </div>
    </div>
  )
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  if (msg.role === "system") {
    if (msg.text === "__RATE_LIMIT__") return <RateLimitCard />
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

  // Escapar HTML
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

  // Links
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" style="color:#4AF6C3;text-decoration:underline">$1</a>',
  )

  // Negrita — resaltada en naranja para datos clave
  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong style="color:#FFA028;font-weight:700">$1</strong>',
  )

  // Listas con guión o bullet
  html = html.replace(
    /^[-•]\s(.+)$/gm,
    '<span style="display:block;padding-left:10px;margin:2px 0">▸ $1</span>',
  )

  // Fuente al final — atenuar [Fuente · fecha]
  html = html.replace(
    /\[([^\]]+·[^\]]+)\]/g,
    '<span style="color:#444;font-size:9px">[$1]</span>',
  )

  // Saltos de línea
  html = html.replace(/\n/g, "<br/>")

  return html
}
