"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginForm() {
  const [password, setPassword] = useState("")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const router      = useRouter()
  const searchParams = useSearchParams()
  const from        = searchParams.get("from") ?? "/admin/completitud"

  const submit = async () => {
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      })
      if (!res.ok) { setError("Contraseña incorrecta"); return }
      router.push(from)
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight:      "100vh",
      background:     "#000",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontFamily:     "monospace",
    }}>
      <div style={{
        width:        320,
        background:   "#080808",
        border:       "1px solid #1a1a1a",
        borderRadius: 6,
        padding:      "32px 24px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 8 }}>
            LA PIZARRA
          </div>
          <div style={{ fontSize: 16, color: "#fff", fontWeight: 700 }}>
            Panel de Administración
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            autoFocus
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            style={{
              background:   "#0d0d0d",
              border:       "1px solid #222",
              borderRadius: 3,
              color:        "#ccc",
              fontFamily:   "monospace",
              fontSize:     12,
              padding:      "10px 12px",
              outline:      "none",
            }}
          />
          {error && (
            <div style={{ fontSize: 10, color: "#FF433D" }}>⚠ {error}</div>
          )}
          <button
            onClick={submit}
            disabled={loading || !password}
            style={{
              background:   loading ? "#111" : "#FFA028",
              color:        loading ? "#444" : "#000",
              border:       "none",
              borderRadius: 3,
              padding:      "10px",
              fontSize:     11,
              fontFamily:   "monospace",
              fontWeight:   700,
              cursor:       loading ? "default" : "pointer",
              letterSpacing: 1,
            }}
          >
            {loading ? "···" : "INGRESAR"}
          </button>
        </div>
      </div>
    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
