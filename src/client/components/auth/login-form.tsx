"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/client/components/ui/button"
import { Input } from "@/client/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card"

type Modo = "login" | "signup"

export function LoginForm() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setAviso(null)

    try {
      const response = await fetch(`/api/auth/${modo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error?.message ?? "Algo salió mal")
      }

      if (modo === "signup" && payload?.data?.requiereConfirmacion) {
        setAviso("Cuenta creada. Revisá tu mail para confirmarla antes de iniciar sesión.")
        return
      }
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{modo === "login" ? "Iniciar sesión" : "Crear cuenta"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={modo === "login" ? "current-password" : "new-password"} />

          {error && <p className="text-xs text-red-400">{error}</p>}
          {aviso && <p className="text-xs text-emerald-400">{aviso}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Un momento…" : modo === "login" ? "Entrar" : "Crear cuenta"}
          </Button>

          <button
            type="button"
            onClick={() => { setModo(modo === "login" ? "signup" : "login"); setError(null); setAviso(null) }}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            {modo === "login" ? "¿No tenés cuenta? Creá una" : "¿Ya tenés cuenta? Iniciá sesión"}
          </button>
        </form>
      </CardContent>
    </Card>
  )
}
