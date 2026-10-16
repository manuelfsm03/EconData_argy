"use client"

// Modal para crear una alerta nueva.
// Alineado al design system: fondo dark elevado, borders --border, acento amber.

import { useState } from "react"
import {
  ALERTA_OPERADORES,
  DOLAR_VARIEDADES,
  type AlertaOperador,
  type AlertaTipo,
  type DolarVariedad,
} from "@/server/domain/alertas"

const NOMBRE_VARIEDAD: Record<DolarVariedad, string> = {
  blue:            "Blue",
  oficial:         "Oficial",
  bolsa:           "MEP",
  contadoconliqui: "CCL",
  mayorista:       "Mayorista",
  cripto:          "Cripto",
  tarjeta:         "Tarjeta",
}

interface Props {
  emailUsuario: string
  onCerrar:     () => void
  onCreada:     () => void
}

export default function NuevaAlertaModal({ emailUsuario, onCerrar, onCreada }: Props) {
  const [tipo, setTipo]               = useState<AlertaTipo>("dolar")
  const [variedad, setVariedad]       = useState<DolarVariedad>("blue")
  const [operador, setOperador]       = useState<AlertaOperador>(">")
  const [umbral, setUmbral]           = useState<string>("")
  const [emailDestino, setEmail]      = useState<string>(emailUsuario)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Armar config según tipo
    let config: Record<string, unknown> = {}
    if (tipo === "dolar") {
      const n = parseFloat(umbral.replace(",", "."))
      if (!Number.isFinite(n)) { setError("Umbral inválido"); return }
      config = { variedad, operador, umbral: n }
    } else if (tipo === "tasa_bcra") {
      const n = parseFloat(umbral.replace(",", "."))
      if (!Number.isFinite(n)) { setError("Umbral inválido"); return }
      config = { operador, umbral: n }
    } else {
      config = {}
    }

    setLoading(true)
    const res = await fetch("/api/alertas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, config, canal: "email", emailDestino }),
    })
    setLoading(false)

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error?.message ?? "No se pudo crear la alerta")
      return
    }
    onCreada()
  }

  return (
    <div
      onClick={onCerrar}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 100,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={crear}
        style={{
          width: 480, maxWidth: "100%",
          background: "var(--bg-elev)", border: "1px solid var(--border-hi)",
          borderRadius: 8, padding: 24, display: "flex", flexDirection: "column", gap: 14,
          color: "var(--text)",
        }}
      >
        <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
          Nueva alerta
        </div>

        {/* Tipo */}
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as AlertaTipo)} style={inputStyle}>
            <option value="dolar">Dólar</option>
            <option value="tasa_bcra">Tasa BCRA</option>
            <option value="publicacion_ipc">Publicación IPC</option>
          </select>
        </Field>

        {/* Config Dólar */}
        {tipo === "dolar" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr", gap: 8 }}>
            <Field label="Variedad">
              <select value={variedad} onChange={(e) => setVariedad(e.target.value as DolarVariedad)} style={inputStyle}>
                {DOLAR_VARIEDADES.map((v) => (
                  <option key={v} value={v}>{NOMBRE_VARIEDAD[v]}</option>
                ))}
              </select>
            </Field>
            <Field label="Operador">
              <select value={operador} onChange={(e) => setOperador(e.target.value as AlertaOperador)} style={inputStyle}>
                {ALERTA_OPERADORES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Umbral ($)">
              <input type="text" inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)}
                     placeholder="1500" required style={{ ...inputStyle, fontFamily: "var(--font-data)" }} />
            </Field>
          </div>
        )}

        {/* Config Tasa BCRA */}
        {tipo === "tasa_bcra" && (
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
            <Field label="Operador">
              <select value={operador} onChange={(e) => setOperador(e.target.value as AlertaOperador)} style={inputStyle}>
                {ALERTA_OPERADORES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Umbral (% TNA)">
              <input type="text" inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)}
                     placeholder="35" required style={{ ...inputStyle, fontFamily: "var(--font-data)" }} />
            </Field>
          </div>
        )}

        {/* Publicación IPC */}
        {tipo === "publicacion_ipc" && (
          <div style={{ padding: 12, background: "var(--bg-elev-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text-dim)" }}>
            Te vamos a avisar cuando INDEC publique un nuevo dato mensual del IPC.
          </div>
        )}

        {/* Email destino */}
        <Field label="Email para el aviso">
          <input type="email" value={emailDestino} onChange={(e) => setEmail(e.target.value)}
                 required style={inputStyle} />
        </Field>

        {/* Próximamente */}
        <div style={{ fontSize: 11, color: "var(--text-mute)" }}>
          Canal: Email · <span>Telegram y Push web próximamente</span>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "var(--negative)" }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" onClick={onCerrar} style={btnSecundario}>Cancelar</button>
          <button type="submit" disabled={loading} style={{
            padding: "8px 16px", background: "var(--amber)", color: "#0a0a0a",
            border: "none", borderRadius: 4, fontSize: 12, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 1,
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "Creando..." : "Crear alerta"}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "var(--bg)",
  border: "1px solid var(--border-hi)",
  borderRadius: 4,
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  fontFamily: "var(--font-ui)",
}

const btnSecundario: React.CSSProperties = {
  padding: "8px 14px",
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--border-hi)",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: 0.5,
}
