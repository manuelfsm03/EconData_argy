"use client"

// Cliente principal del panel de alertas — orquesta la lista y el modal de creación.
// Estilo alineado al design system: fondo var(--bg), acento var(--amber),
// mono IBM Plex para números, panel bbg.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import NuevaAlertaModal from "./nueva-alerta-modal"
import type { AlertaConfig, AlertaTipo } from "@/server/domain/alertas"

export interface AlertaResumen {
  id:            string
  tipo:          AlertaTipo
  config:        AlertaConfig
  canal:         string
  emailDestino:  string
  estado:        "activa" | "pausada" | "disparada"
  ultimoDisparo: string | null
  createdAt:     string
  descripcion:   string
}

interface Props {
  alertasIniciales: AlertaResumen[]
  limiteFree:       number
  emailUsuario:     string
}

export default function AlertasClient({ alertasIniciales, limiteFree, emailUsuario }: Props) {
  const router = useRouter()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pending, startTransition] = useTransition()
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)

  const activas = alertasIniciales.filter((a) => a.estado === "activa").length
  const alcanzoLimite = activas >= limiteFree

  function refrescar() {
    startTransition(() => router.refresh())
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta alerta?")) return
    setErrorGlobal(null)
    const res = await fetch(`/api/alertas/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setErrorGlobal("No se pudo borrar la alerta")
      return
    }
    refrescar()
  }

  async function cambiarEstado(id: string, nuevo: "activa" | "pausada") {
    setErrorGlobal(null)
    const res = await fetch(`/api/alertas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevo }),
    })
    if (!res.ok) {
      setErrorGlobal("No se pudo actualizar la alerta")
      return
    }
    refrescar()
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "40px 24px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
              La Pizarra · Alertas
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 0" }}>
              Tus alertas
              <span style={{ marginLeft: 12, fontSize: 13, color: "var(--text-dim)", fontFamily: "var(--font-data)", fontWeight: 500 }}>
                {activas}/{limiteFree} activas
              </span>
            </h1>
          </div>
          <button
            onClick={() => setModalAbierto(true)}
            disabled={alcanzoLimite}
            style={{
              padding: "10px 18px",
              background: alcanzoLimite ? "var(--bg-elev-2)" : "var(--amber)",
              color: alcanzoLimite ? "var(--text-dim)" : "#0a0a0a",
              border: "none", borderRadius: 4, fontSize: 12, fontWeight: 700,
              letterSpacing: 1, textTransform: "uppercase",
              cursor: alcanzoLimite ? "not-allowed" : "pointer",
            }}
          >
            + Nueva alerta
          </button>
        </div>

        {alcanzoLimite && (
          <div style={{
            padding: "12px 16px",
            background: "var(--amber-soft)",
            border: "1px solid var(--amber)",
            borderRadius: 6, fontSize: 13,
            marginBottom: 20,
          }}>
            Llegaste al límite del plan free ({limiteFree} alertas activas).
            <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>
              Próximamente: plan Pro con alertas ilimitadas.
            </span>
          </div>
        )}

        {errorGlobal && (
          <div style={{ padding: "10px 14px", background: "#3a1414", border: "1px solid var(--negative)", borderRadius: 6, fontSize: 13, marginBottom: 20 }}>
            {errorGlobal}
          </div>
        )}

        {/* Lista */}
        {alertasIniciales.length === 0 ? (
          <div style={{
            padding: 40, textAlign: "center", border: "1px dashed var(--border)",
            borderRadius: 8, background: "var(--bg-elev)", color: "var(--text-dim)",
          }}>
            Todavía no tenés alertas. Creá la primera para recibir un email cuando se dispare.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {alertasIniciales.map((a) => (
              <AlertaCard
                key={a.id}
                alerta={a}
                onBorrar={() => borrar(a.id)}
                onPausar={() => cambiarEstado(a.id, "pausada")}
                onReanudar={() => cambiarEstado(a.id, "activa")}
                pending={pending}
              />
            ))}
          </div>
        )}

        {/* Canales próximamente */}
        <div style={{ marginTop: 32, fontSize: 12, color: "var(--text-mute)" }}>
          Canales disponibles: <b style={{ color: "var(--text-dim)" }}>Email</b>
          <span> · Telegram y Push web </span>
          <span style={{
            padding: "2px 6px", background: "var(--bg-elev-2)", borderRadius: 3,
            color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8,
          }}>próximamente</span>
        </div>
      </div>

      {modalAbierto && (
        <NuevaAlertaModal
          emailUsuario={emailUsuario}
          onCerrar={() => setModalAbierto(false)}
          onCreada={() => {
            setModalAbierto(false)
            refrescar()
          }}
        />
      )}
    </div>
  )
}

// ── Card individual ──────────────────────────────────────────────────────────
function AlertaCard({
  alerta, onBorrar, onPausar, onReanudar, pending,
}: {
  alerta: AlertaResumen
  onBorrar: () => void
  onPausar: () => void
  onReanudar: () => void
  pending: boolean
}) {
  const colorEstado =
    alerta.estado === "activa"    ? "var(--positive)" :
    alerta.estado === "pausada"   ? "var(--text-dim)" :
    /* disparada */                 "var(--amber)"

  return (
    <div style={{
      padding: "16px 20px",
      background: "var(--bg-elev)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 12,
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{alerta.descripcion}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-data)" }}>
          <span style={{ color: colorEstado, fontWeight: 700 }}>{alerta.estado.toUpperCase()}</span>
          <span style={{ marginLeft: 12 }}>{alerta.canal}: {alerta.emailDestino}</span>
          {alerta.ultimoDisparo && (
            <span style={{ marginLeft: 12 }}>
              último disparo: {new Date(alerta.ultimoDisparo).toLocaleString("es-AR")}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {alerta.estado === "activa" && (
          <button onClick={onPausar} disabled={pending} style={btnSecundario}>Pausar</button>
        )}
        {(alerta.estado === "pausada" || alerta.estado === "disparada") && (
          <button onClick={onReanudar} disabled={pending} style={btnSecundario}>
            {alerta.estado === "disparada" ? "Reactivar" : "Reanudar"}
          </button>
        )}
        <button onClick={onBorrar} disabled={pending} style={{ ...btnSecundario, color: "var(--negative)" }}>
          Borrar
        </button>
      </div>
    </div>
  )
}

const btnSecundario: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--border-hi)",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: 0.5,
}
