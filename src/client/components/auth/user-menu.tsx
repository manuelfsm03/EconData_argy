"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, User } from "lucide-react"

type Sesion = { username: string; email: string | null } | null

export function UserMenu() {
  const router = useRouter()
  const [sesion, setSesion] = useState<Sesion>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => setSesion(j.data ? { username: j.data.username, email: j.data.email } : null))
      .finally(() => setLoading(false))
  }, [])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    setSesion(null)
    router.refresh()
  }

  if (loading) return null

  if (!sesion) {
    return (
      <a href="/login" className="flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text)]">
        <User size={12} /> Iniciar sesión
      </a>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[var(--text-dim)]">@{sesion.username}</span>
      <button onClick={logout} title="Cerrar sesión" className="text-[var(--text-mute)] hover:text-[var(--text)]">
        <LogOut size={13} />
      </button>
    </div>
  )
}
