"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark"
    setTheme(current)
    setMounted(true)
  }, [])

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.setAttribute("data-theme", next)
    try { localStorage.setItem("lp-theme", next) } catch {}
  }

  if (!mounted) {
    return <div style={{ width: 58, height: 28, flexShrink: 0 }} aria-hidden />
  }

  const isDark = theme === "dark"

  return (
    <button
      onClick={toggle}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{
        display: "flex", alignItems: "center", gap: 2,
        padding: 3, height: 28,
        borderRadius: 999,
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        cursor: "pointer", flexShrink: 0,
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isDark ? "var(--amber)" : "transparent",
        transition: "background 0.18s ease",
      }}>
        <Moon size={12} strokeWidth={2} color={isDark ? "var(--bg)" : "var(--text-dim)"} />
      </span>
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: !isDark ? "var(--amber)" : "transparent",
        transition: "background 0.18s ease",
      }}>
        <Sun size={12} strokeWidth={2} color={!isDark ? "var(--bg)" : "var(--text-dim)"} />
      </span>
    </button>
  )
}
