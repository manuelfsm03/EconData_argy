"use client"

/**
 * /coyuntura — página standalone del morning brief.
 *
 * Sirve como landing "compartible" del brief generado por el agente
 * (Claude Haiku 4.5, 2x/día). Útil para linkear desde WhatsApp/Twitter
 * sin obligar al lector a explorar tabs.
 */

import { NewsBrief } from "@/client/components/dashboard/news-brief"
import Link from "next/link"

export default function CoyunturaPage() {
  return (
    <main
      style={{
        background: "var(--bg)",
        minHeight: "100vh",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-mute)",
            fontFamily: "var(--font-data)",
            textTransform: "uppercase",
            letterSpacing: 1.8,
            marginBottom: 6,
          }}
        >
          La Pizarra
        </div>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: -0.4,
            margin: "0 0 8px 0",
          }}
        >
          Coyuntura económica argentina
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 24px 0", lineHeight: 1.55 }}>
          Resumen automatizado de las últimas 24hs. El agente lee las principales fuentes AR
          (Cronista, Ámbito, BAE, Infobae) y arma este brief 2 veces por día.
        </p>

        <NewsBrief />

        <div style={{ marginTop: 20, fontSize: 12 }}>
          <Link
            href="/"
            style={{
              color: "var(--amber)",
              textDecoration: "none",
              fontFamily: "var(--font-ui)",
            }}
          >
            ← Volver al dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
