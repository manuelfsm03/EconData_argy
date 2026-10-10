/**
 * Layout compartido para páginas legales (privacidad, términos).
 *
 * Server component, sin JS del cliente. Optimizado para SEO y accesibilidad.
 */

import Link from "next/link"
import type { ReactNode } from "react"

export function LegalLayout({
  titulo, ultimaActualizacion, children,
}: {
  titulo: string
  ultimaActualizacion: string
  children: ReactNode
}) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      fontFamily: "var(--font-sans, ui-sans-serif, system-ui)",
      padding: "48px 20px 96px",
    }}>
      <article style={{
        maxWidth: 720,
        margin: "0 auto",
        fontSize: 15,
        lineHeight: 1.6,
      }}>
        {/* Header */}
        <header style={{ marginBottom: 32, borderBottom: "1px solid var(--border)", paddingBottom: 20 }}>
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            color: "var(--text-dim)", fontSize: 12, textDecoration: "none",
            marginBottom: 20,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 4, background: "var(--amber)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#000", fontWeight: 900, fontSize: 12,
            }}>=</span>
            <span style={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>La Pizarra</span>
          </Link>
          <h1 style={{
            fontSize: 28, fontWeight: 700, margin: 0, color: "var(--text)",
            letterSpacing: -0.5,
          }}>
            {titulo}
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "8px 0 0" }}>
            Última actualización: {ultimaActualizacion}
          </p>
        </header>

        {/* Body */}
        <div style={{ color: "var(--text)" }}>
          {children}
        </div>

        {/* Footer */}
        <footer style={{ marginTop: 64, paddingTop: 20, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-dim)", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "var(--text-dim)" }}>← Volver a La Pizarra</Link>
          <Link href="/privacidad" style={{ color: "var(--text-dim)" }}>Privacidad</Link>
          <Link href="/terminos" style={{ color: "var(--text-dim)" }}>Términos</Link>
          <a href="mailto:lapizarra.ar@gmail.com" style={{ color: "var(--text-dim)" }}>Contacto</a>
        </footer>
      </article>
    </div>
  )
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 style={{
      fontSize: 18, fontWeight: 600, margin: "36px 0 12px",
      color: "var(--text)", letterSpacing: -0.2,
    }}>
      {children}
    </h2>
  )
}

export function P({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ margin: "0 0 12px", color: "var(--text)", ...style }}>
      {children}
    </p>
  )
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul style={{ margin: "0 0 16px", paddingLeft: 20, color: "var(--text)" }}>
      {children}
    </ul>
  )
}

export function LI({ children }: { children: ReactNode }) {
  return <li style={{ marginBottom: 6 }}>{children}</li>
}

export function Section({ children }: { children: ReactNode }) {
  return <section style={{ marginBottom: 8 }}>{children}</section>
}
