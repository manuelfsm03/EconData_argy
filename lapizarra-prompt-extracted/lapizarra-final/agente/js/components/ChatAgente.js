/**
 * js/components/ChatAgente.js
 * ---------------------------------------------------------
 * Componente del chat conversacional del agente.
 *
 * Patrón: React 18 via CDN + Babel Standalone. Sin imports ES6.
 * Los componentes se definen como globals en window (mismo
 * patrón que SeccionDolar, SeccionMacro, etc. del repo).
 *
 * Uso desde otro componente:
 *   <ChatAgente />
 *
 * Styling: reutiliza variables CSS de styles.css cuando existen.
 * ---------------------------------------------------------
 */

const { useState, useRef, useEffect } = React;

const MODELS_CHAT = [
  { id: "haiku-4.5", label: "Haiku 4.5" },
  { id: "gemini-flash", label: "Gemini Flash" },
];

const MAX_MESSAGE_LEN = 500;

function ChatAgente() {
  const [messages, setMessages] = useState([
    {
      role: "agent",
      text: "Preguntame sobre dólar, inflación, macro, mercados globales o noticias del dashboard.",
      id: "welcome",
    },
  ]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("haiku-4.5");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [rateLimited, setRateLimited] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || rateLimited) return;

    const userMsg = { role: "user", text, id: `u_${Date.now()}` };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, model }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setRateLimited(true);
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: "Llegaste al límite de 3 consultas diarias. Volvé mañana.",
            id: `s_${Date.now()}`,
          },
        ]);
        return;
      }

      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: "error",
            text: (data && data.detail && data.detail.error) || data.detail || "Error procesando la consulta.",
            id: `e_${Date.now()}`,
          },
        ]);
        return;
      }

      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: data.answer,
          id: `a_${Date.now()}`,
          toolCalls: data.tool_calls,
          modelUsed: data.model_used,
        },
      ]);
      setRemaining(data.remaining);
      if (data.remaining === 0) setRateLimited(true);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "error",
          text: "No pude conectar con el agente. Probá de nuevo.",
          id: `e_${Date.now()}`,
        },
      ]);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charsLeft = MAX_MESSAGE_LEN - input.length;

  return (
    <div className="chat-agente">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-dot"></span>
          <span className="chat-title">Asistente</span>
        </div>
        <div className="chat-header-right">
          <select
            className="chat-model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            aria-label="Elegir modelo"
          >
            {MODELS_CHAT.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mensajes */}
      <div className="chat-messages" ref={scrollRef} aria-live="polite">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {loading && <LoadingBubble />}
      </div>

      {/* Footer */}
      <div className="chat-footer">
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LEN))}
            onKeyDown={handleKeyDown}
            placeholder={
              rateLimited
                ? "Alcanzaste el límite"
                : "¿Qué querés saber del mercado hoy?"
            }
            disabled={loading || rateLimited}
            rows={1}
            maxLength={MAX_MESSAGE_LEN}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={loading || rateLimited || !input.trim()}
            aria-label="Enviar"
          >
            {loading ? "···" : "→"}
          </button>
        </div>
        <div className="chat-meta">
          <span className="chat-chars">
            {charsLeft < 100 ? `${charsLeft} caracteres` : ""}
          </span>
          <span className="chat-remaining">
            {remaining !== null && (
              <>
                <span className="dim">consultas restantes:</span>{" "}
                <strong>{remaining}/3</strong>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Subcomponentes
// ──────────────────────────────────────────────────────────

function MessageBubble({ message }) {
  const { role, text, toolCalls, modelUsed } = message;

  if (role === "system") {
    return <div className="chat-system-msg">{text}</div>;
  }

  if (role === "error") {
    return (
      <div className="chat-error-msg">
        <span className="chat-error-icon">⚠</span> {text}
      </div>
    );
  }

  if (role === "user") {
    return (
      <div className="chat-user-row">
        <div className="chat-user-bubble">{text}</div>
      </div>
    );
  }

  // agent
  return (
    <div className="chat-agent-row">
      <div className="chat-agent-bubble">
        <div
          className="chat-agent-text"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
        {(toolCalls?.length > 0 || modelUsed) && (
          <div className="chat-agent-footer">
            {modelUsed && (
              <span className="chat-tag">{formatModel(modelUsed)}</span>
            )}
            {(toolCalls || []).map((tc, i) => (
              <span
                key={i}
                className={`chat-tag ${tc.ok ? "ok" : "fail"}`}
                title={JSON.stringify(tc.args)}
              >
                {formatToolName(tc.tool)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingBubble() {
  const phrases = [
    "Consultando dashboard",
    "Analizando datos",
    "Armando respuesta",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % phrases.length), 1200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="chat-loading-row">
      <div className="chat-loading-bubble">
        <span className="chat-loading-text">{phrases[idx]}</span>
        <span className="chat-loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
  );
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

function formatToolName(name) {
  const map = {
    get_dolar_bcra: "dólar/bcra",
    get_macro: "macro",
    get_ipc: "ipc",
    get_deuda_fiscal: "deuda/fiscal",
    get_mundo: "mundo",
    get_noticias: "noticias",
  };
  return map[name] || name;
}

function formatModel(id) {
  return id === "haiku-4.5" ? "Haiku" : id === "gemini-flash" ? "Gemini" : id;
}

// Expose to global scope (mismo patrón que el resto del repo)
window.ChatAgente = ChatAgente;
