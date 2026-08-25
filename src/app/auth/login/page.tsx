"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [mode,     setMode]     = useState<"login" | "register">("login")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg, #0a0a0a)", fontFamily: "monospace",
    }}>
      <div style={{
        width: 340, padding: 32, border: "1px solid #2a2a2a", borderRadius: 8,
        background: "#111", display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: "#E97316",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 16, color: "#000",
          }}>
            =
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>
            La Pizarra
          </span>
        </div>

        <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
          {mode === "login" ? "Ingresá con tu cuenta" : "Creá tu cuenta"}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: 11, color: "#f87171", margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 0", background: "#E97316", color: "#000", border: "none",
              borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, letterSpacing: 0.5, textTransform: "uppercase",
            }}
          >
            {loading ? "..." : mode === "login" ? "Entrar" : "Registrarme"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{
            background: "none", border: "none", color: "#666", fontSize: 11,
            cursor: "pointer", textDecoration: "underline", padding: 0,
          }}
        >
          {mode === "login" ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Ingresá"}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", background: "#1a1a1a", border: "1px solid #2a2a2a",
  borderRadius: 4, color: "#fff", fontSize: 12, outline: "none", fontFamily: "monospace",
}
