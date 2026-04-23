import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Suscripción — La Pizarra",
  description: "Acceso ilimitado al asistente Pizi y funciones exclusivas de La Pizarra.",
}

const TIERS = [
  {
    id:      "free",
    name:    "Gratis",
    price:   "$0",
    period:  "",
    tag:     null,
    color:   "#444",
    border:  "#1a1a1a",
    glow:    false,
    features: [
      { ok: true,  text: "3 consultas a Pizi por día" },
      { ok: true,  text: "Dashboard completo de datos" },
      { ok: true,  text: "Noticias en tiempo real" },
      { ok: false, text: "Informes de La Pizarra" },
      { ok: false, text: "Descarga de datos CSV" },
      { ok: false, text: "Alertas de precios" },
      { ok: false, text: "Comunidad de debate" },
      { ok: false, text: "Newsletter semanal" },
    ],
    cta:    "Tu plan actual",
    ctaUrl: "/",
    muted:  true,
  },
  {
    id:      "colaborador",
    name:    "Colaborador",
    price:   "USD 3",
    period:  "/ mes",
    tag:     null,
    color:   "#4FC3F7",
    border:  "#4FC3F7",
    glow:    false,
    features: [
      { ok: true, text: "30 consultas a Pizi por día" },
      { ok: true, text: "Dashboard completo de datos" },
      { ok: true, text: "Noticias en tiempo real" },
      { ok: true, text: "Últimos informes de La Pizarra" },
      { ok: true, text: "Descarga de datos en CSV" },
      { ok: true, text: "Comunidad de debate" },
      { ok: false, text: "Alertas de precios personalizadas" },
      { ok: false, text: "Newsletter semanal + historial Pizi" },
    ],
    cta:    "Suscribirme",
    ctaUrl: "#pago",
    muted:  false,
  },
  {
    id:      "pro",
    name:    "Pro",
    price:   "USD 8",
    period:  "/ mes",
    tag:     "MÁS VALOR",
    color:   "#FFA028",
    border:  "#FFA028",
    glow:    true,
    features: [
      { ok: true, text: "Pizi ilimitado" },
      { ok: true, text: "Dashboard completo de datos" },
      { ok: true, text: "Noticias en tiempo real" },
      { ok: true, text: "Todos los informes + acceso anticipado" },
      { ok: true, text: "Descarga de datos en CSV" },
      { ok: true, text: "Comunidad de debate + webinars mensuales" },
      { ok: true, text: "Alertas de precios personalizadas" },
      { ok: true, text: "Newsletter semanal + historial de Pizi" },
    ],
    cta:    "Quiero Pro",
    ctaUrl: "#pago",
    muted:  false,
  },
]

const FAQS = [
  {
    q: "¿Cómo funciona el límite de Pizi?",
    a: "El plan Gratis permite 3 consultas al día al asistente. El plan Colaborador sube a 30 y el Pro es ilimitado. El contador se resetea a medianoche (hora Argentina).",
  },
  {
    q: "¿Qué son las alertas de precios?",
    a: "Podés configurar notificaciones cuando el dólar blue, el riesgo país u otro indicador supere o baje de un umbral que vos definís.",
  },
  {
    q: "¿Qué incluye la comunidad de debate?",
    a: "Acceso a un espacio exclusivo para discutir el contexto económico, compartir análisis y consultar con otros usuarios y con el equipo de La Pizarra.",
  },
  {
    q: "¿Puedo cancelar cuando quiero?",
    a: "Sí, sin permanencia mínima. Cancelás y perdés los beneficios al final del período pagado.",
  },
]

export default function SuscripcionPage() {
  return (
    <main style={{
      minHeight:     "100vh",
      background:    "#000",
      color:         "#ccc",
      fontFamily:    "monospace",
      padding:       "48px 20px 64px",
    }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Link href="/" style={{ fontSize: 9, color: "#333", textDecoration: "none", letterSpacing: 1, display: "block", marginBottom: 24 }}>
            ← LA PIZARRA
          </Link>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #FFB84D, #E8870A)",
              border: "2px solid #FFA028",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2C5.58 2 2 5.13 2 9c0 1.9.8 3.63 2.1 4.9L3 18l4.5-1.4C8.6 16.85 9.28 17 10 17c4.42 0 8-3.13 8-7s-3.58-8-8-8z" fill="#000"/>
              </svg>
            </div>
            <span style={{ fontSize: 9, color: "#FFA028", letterSpacing: 3, textTransform: "uppercase" }}>
              La Pizarra · Planes
            </span>
          </div>
          <h1 style={{ fontSize: 26, color: "#fff", margin: "0 0 12px", fontWeight: 700, letterSpacing: -0.5 }}>
            Datos económicos sin límites
          </h1>
          <p style={{ fontSize: 12, color: "#555", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
            La Pizarra es un dashboard independiente. Tu suscripción nos permite seguir mejorando
            los datos, el asistente y el análisis — sin publicidad.
          </p>
        </div>

        {/* Tiers */}
        <div style={{
          display:        "flex",
          gap:            16,
          flexWrap:       "wrap",
          justifyContent: "center",
          marginBottom:   56,
          alignItems:     "stretch",
        }}>
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              style={{
                width:         280,
                background:    "#080808",
                border:        `1px solid ${tier.border}`,
                borderRadius:  6,
                padding:       "24px 20px",
                display:       "flex",
                flexDirection: "column",
                gap:           0,
                boxShadow:     tier.glow ? `0 0 32px rgba(255,160,40,0.12)` : "none",
                position:      "relative",
              }}
            >
              {/* Badge */}
              {tier.tag && (
                <div style={{
                  position:    "absolute",
                  top:         -10,
                  left:        "50%",
                  transform:   "translateX(-50%)",
                  background:  "#FFA028",
                  color:       "#000",
                  fontSize:    8,
                  fontWeight:  700,
                  padding:     "2px 10px",
                  borderRadius: 20,
                  letterSpacing: 1,
                  whiteSpace:  "nowrap",
                }}>
                  {tier.tag}
                </div>
              )}

              {/* Nombre */}
              <div style={{ fontSize: 9, color: tier.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                {tier.name}
              </div>

              {/* Precio */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: tier.muted ? "#333" : "#fff" }}>
                  {tier.price}
                </span>
                <span style={{ fontSize: 11, color: "#444" }}>{tier.period}</span>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {tier.features.map((f, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 10.5, color: f.ok ? (tier.muted ? "#444" : "#999") : "#2a2a2a" }}>
                    <span style={{ flexShrink: 0, color: f.ok ? tier.color : "#222", fontWeight: 700 }}>
                      {f.ok ? "✓" : "✗"}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={tier.ctaUrl}
                style={{
                  display:        "block",
                  textAlign:      "center",
                  padding:        "10px",
                  background:     tier.muted ? "transparent" : tier.glow ? "#FFA028" : "transparent",
                  color:          tier.muted ? "#2a2a2a" : tier.glow ? "#000" : tier.color,
                  border:         `1px solid ${tier.muted ? "#1a1a1a" : tier.color}`,
                  borderRadius:   3,
                  fontSize:       10,
                  fontWeight:     700,
                  fontFamily:     "monospace",
                  textDecoration: "none",
                  letterSpacing:  1,
                  cursor:         tier.muted ? "default" : "pointer",
                  pointerEvents:  tier.muted ? "none" : "auto",
                  textTransform:  "uppercase",
                }}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Comparativa rápida */}
        <div style={{ marginBottom: 56, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#444", fontWeight: 400, width: "40%" }}>Función</th>
                <th style={{ textAlign: "center", padding: "8px 12px", color: "#444", fontWeight: 400 }}>Gratis</th>
                <th style={{ textAlign: "center", padding: "8px 12px", color: "#4FC3F7", fontWeight: 700 }}>Colaborador</th>
                <th style={{ textAlign: "center", padding: "8px 12px", color: "#FFA028", fontWeight: 700 }}>Pro</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Consultas a Pizi",              "3/día",   "30/día",   "Ilimitadas"],
                ["Dashboard de datos",             "✓",       "✓",        "✓"],
                ["Noticias en tiempo real",        "✓",       "✓",        "✓"],
                ["Informes de La Pizarra",         "—",       "✓",        "✓"],
                ["Descarga CSV",                   "—",       "✓",        "✓"],
                ["Comunidad de debate",            "—",       "✓",        "✓"],
                ["Alertas de precios",             "—",       "—",        "✓"],
                ["Newsletter semanal",             "—",       "—",        "✓"],
                ["Historial de consultas Pizi",    "—",       "—",        "✓"],
                ["Webinars mensuales",             "—",       "—",        "✓"],
                ["Acceso anticipado a funciones",  "—",       "—",        "✓"],
              ].map(([fn, f, c, p], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #0d0d0d", background: i % 2 === 0 ? "#050505" : "transparent" }}>
                  <td style={{ padding: "8px 12px", color: "#666" }}>{fn}</td>
                  <td style={{ textAlign: "center", padding: "8px 12px", color: "#333" }}>{f}</td>
                  <td style={{ textAlign: "center", padding: "8px 12px", color: "#4FC3F7" }}>{c}</td>
                  <td style={{ textAlign: "center", padding: "8px 12px", color: "#FFA028" }}>{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sección de pago */}
        <div id="pago" style={{
          background:   "#080808",
          border:       "1px solid #1a1a1a",
          borderRadius: 6,
          padding:      "32px 24px",
          textAlign:    "center",
          marginBottom: 48,
        }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            Método de pago
          </div>
          <div style={{
            padding:      "32px 20px",
            border:       "1px dashed #1a1a1a",
            borderRadius: 4,
            color:        "#333",
            fontSize:     11,
            lineHeight:   1.8,
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔧</div>
            Integración de pasarela de pago en desarrollo<br/>
            <span style={{ fontSize: 9, color: "#2a2a2a" }}>Mercado Pago · Stripe · próximamente</span>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 9, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>
            Preguntas frecuentes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background:   "#080808",
                border:       "1px solid #111",
                borderRadius: 4,
                padding:      "14px 16px",
              }}>
                <div style={{ fontSize: 11, color: "#ccc", fontWeight: 700, marginBottom: 6 }}>{faq.q}</div>
                <div style={{ fontSize: 10.5, color: "#555", lineHeight: 1.6 }}>{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center" }}>
          <Link href="/" style={{ fontSize: 9, color: "#333", textDecoration: "none", letterSpacing: 1 }}>
            ← Volver al dashboard
          </Link>
        </div>

      </div>
    </main>
  )
}
