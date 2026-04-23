"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface SetupData {
  secret:          string
  qr_data_url:     string
  ya_configurado:  boolean
  instrucciones:   string
}

export default function TOTPSetupPage() {
  const router  = useRouter()
  const [data,    setData]    = useState<SetupData | null>(null)
  const [code,    setCode]    = useState("")
  const [loading, setLoading] = useState(true)
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch("/api/admin/totp-setup")
      .then(r => { if (r.status === 401) { router.push("/admin/login"); return null } return r.json() })
      .then(d => { if (d) setData(d as SetupData) })
      .finally(() => setLoading(false))
  }, [router])

  const verify = async () => {
    if (code.length !== 6) return
    const res  = await fetch("/api/admin/totp-setup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code }),
    })
    const d = await res.json() as { ok?: boolean; error?: string }
    setResult({ ok: res.ok, msg: d.ok ? "✓ Código válido — TOTP funcionando correctamente" : (d.error ?? "Error") })
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#ccc", fontFamily: "monospace", padding: "40px 20px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ fontSize: 9, color: "#333", letterSpacing: 2, marginBottom: 8 }}>LA PIZARRA · ADMIN</div>
        <h1 style={{ fontSize: 18, color: "#fff", fontWeight: 700, marginBottom: 4 }}>Configurar Autenticador</h1>
        <p style={{ fontSize: 11, color: "#444", marginBottom: 28 }}>
          Escaneá el QR con Microsoft Authenticator o Google Authenticator para activar la aprobación por TOTP.
        </p>

        {loading && <div style={{ color: "#333" }}>Cargando ···</div>}

        {data && (
          <>
            {/* Estado */}
            <div style={{
              background: data.ya_configurado ? "#0a1a0a" : "#1a0d00",
              border:     `1px solid ${data.ya_configurado ? "#4AF6C3" : "#FFA028"}`,
              borderRadius: 4, padding: "10px 14px", marginBottom: 20, fontSize: 10,
              color: data.ya_configurado ? "#4AF6C3" : "#FFA028",
            }}>
              {data.ya_configurado ? "✓ TOTP ya configurado — podés re-escanear para sincronizar" : "⚠ TOTP no configurado — escaneá el QR y guardá el secret"}
            </div>

            {/* QR */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qr_data_url} alt="QR TOTP" style={{ width: 200, height: 200, borderRadius: 4 }} />
            </div>

            {/* Secret */}
            <div style={{ background: "#080808", border: "1px solid #1a1a1a", borderRadius: 4, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, marginBottom: 6 }}>SECRET (guardar en TOTP_SECRET)</div>
              <div style={{ fontSize: 13, color: "#FFA028", letterSpacing: 3, fontWeight: 700 }}>{data.secret}</div>
              <div style={{ fontSize: 9, color: "#333", marginTop: 6 }}>
                Agregá <code style={{ color: "#555" }}>TOTP_SECRET={data.secret}</code> en tu .env.local y en Vercel.
              </div>
            </div>

            {/* Verificar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, color: "#444", letterSpacing: 1, marginBottom: 8 }}>VERIFICAR — ingresá el código de tu app</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={e => e.key === "Enter" && verify()}
                  style={{
                    background: "#0d0d0d", border: "1px solid #222", borderRadius: 3,
                    color: "#fff", fontFamily: "monospace", fontSize: 18,
                    padding: "10px 14px", outline: "none", width: 120,
                    letterSpacing: 6, textAlign: "center",
                  }}
                />
                <button
                  onClick={verify}
                  disabled={code.length !== 6}
                  style={{
                    background: code.length === 6 ? "#FFA028" : "#111",
                    color: code.length === 6 ? "#000" : "#444",
                    border: "none", borderRadius: 3, padding: "10px 20px",
                    fontSize: 11, fontWeight: 700, fontFamily: "monospace", cursor: code.length === 6 ? "pointer" : "default",
                  }}
                >
                  VERIFICAR
                </button>
              </div>
              {result && (
                <div style={{ fontSize: 11, color: result.ok ? "#4AF6C3" : "#FF433D", marginTop: 8 }}>
                  {result.msg}
                </div>
              )}
            </div>

            <button
              onClick={() => router.push("/admin")}
              style={{ fontSize: 9, color: "#333", background: "none", border: "none", cursor: "pointer", fontFamily: "monospace" }}
            >
              ← Volver al hub
            </button>
          </>
        )}
      </div>
    </main>
  )
}
