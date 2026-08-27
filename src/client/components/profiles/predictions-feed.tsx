"use client"

import { useEffect, useMemo, useState } from "react"
import { Target } from "lucide-react"
import { MOCK_PROFILES } from "./mock-profiles"
import {
  describirCondicion,
  puntosPorPrediccion,
  type Prediccion,
  type EstadoPrediccion,
} from "@/lib/prediction-contract"

// ── Lookup autor (autorId → datos del perfil) ──────────────────────────────────
const AUTOR_INDEX: Record<string, { handle: string; nivel: string }> = Object.fromEntries(
  MOCK_PROFILES.map((p) => [p.id, { handle: p.handle, nivel: p.nivel }]),
)

function autorLabel(autorId: string): { handle: string; nivel: string } {
  return AUTOR_INDEX[autorId] ?? { handle: "anónimo", nivel: "Novato" }
}

// ── Colores por estado ─────────────────────────────────────────────────────────
const ESTADO_META: Record<EstadoPrediccion, { label: string; color: string; bg: string }> = {
  abierta:  { label: "ABIERTA",  color: "var(--sky)",      bg: "rgba(116,169,201,0.12)" },
  acertada: { label: "ACERTADA", color: "var(--positive)", bg: "rgba(74,201,116,0.12)" },
  errada:   { label: "ERRADA",   color: "var(--negative)", bg: "rgba(201,74,74,0.12)" },
  anulada:  { label: "ANULADA",  color: "var(--text-mute)", bg: "var(--bg-elev-2)" },
}

const TIPO_LABEL: Record<Prediccion["tipoActivo"], string> = {
  bono: "bono", accion: "acción", fx: "FX", tasa: "tasa", indice: "índice", cripto: "cripto",
}

type Filtro = "todas" | EstadoPrediccion

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todas",    label: "Todas" },
  { key: "abierta",  label: "Abiertas" },
  { key: "acertada", label: "Acertadas" },
  { key: "errada",   label: "Erradas" },
]

function fechaCorta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
  } catch { return iso.slice(0, 10) }
}

// ── Card de una predicción ─────────────────────────────────────────────────────
function PrediccionCard({ p }: { p: Prediccion }) {
  const autor = autorLabel(p.autorId)
  const est = ESTADO_META[p.estado]
  const puntos = puntosPorPrediccion(p)

  return (
    <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Autor + estado */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--amber)", fontFamily: "var(--font-data)" }}>@{autor.handle}</span>
        <span style={{ fontSize: 9, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.6 }}>{autor.nivel}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.8, color: est.color, background: est.bg, border: `1px solid ${est.color}`, borderRadius: 3, padding: "1px 6px" }}>
          {est.label}
        </span>
      </div>

      {/* Activo + tipo */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-data)" }}>{p.activo}</span>
        <span style={{ fontSize: 9, color: "var(--text-mute)" }}>{TIPO_LABEL[p.tipoActivo]}</span>
      </div>

      {/* Tesis */}
      <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {p.tesis}
      </div>

      {/* Condición de resolución (auditable) */}
      <div style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)", background: "var(--bg)", border: "1px solid var(--bg-elev-2)", borderRadius: 3, padding: "3px 6px" }}>
        {describirCondicion(p)}
      </div>

      {/* Footer: entrada / resolución / puntos */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
        <span>Entrada {p.valorEntrada.toLocaleString("es-AR")} · {fechaCorta(p.fechaEntrada)}</span>
        <div style={{ flex: 1 }} />
        {p.estado === "acertada" || p.estado === "errada" ? (
          <span style={{ fontWeight: 700, color: puntos >= 0 ? "var(--positive)" : "var(--negative)" }}>
            {puntos >= 0 ? "+" : ""}{puntos} pts
          </span>
        ) : (
          <span>vence {fechaCorta(p.fechaResolucion)}</span>
        )}
      </div>
    </div>
  )
}

// ── Feed principal ─────────────────────────────────────────────────────────────
export function PredictionsFeed() {
  const [preds, setPreds] = useState<Prediccion[] | null>(null)
  const [error, setError] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>("todas")

  useEffect(() => {
    let cancel = false
    fetch("/api/predictions?limit=48")
      .then((r) => r.json())
      .then((j) => { if (!cancel) setPreds(Array.isArray(j.data) ? j.data : []) })
      .catch(() => { if (!cancel) setError(true) })
    return () => { cancel = true }
  }, [])

  const visibles = useMemo(() => {
    if (!preds) return []
    return filtro === "todas" ? preds : preds.filter((p) => p.estado === filtro)
  }, [preds, filtro])

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Header + filtros */}
      <div style={{ padding: "8px 14px", background: "var(--bg-elev-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Target size={12} color="var(--amber)" />
        <span style={{ fontSize: 9, color: "var(--amber)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>
          Predicciones de la comunidad
        </span>
        {preds && <span style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>{preds.length}</span>}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }}>
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
                border: `1px solid ${filtro === f.key ? "var(--amber)" : "var(--border)"}`,
                background: filtro === f.key ? "var(--amber-soft)" : "transparent",
                color: filtro === f.key ? "var(--amber)" : "var(--text-dim)",
                fontWeight: filtro === f.key ? 700 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {error ? (
        <div style={{ padding: 20, textAlign: "center", fontSize: 10, color: "var(--text-dim)" }}>No se pudieron cargar las predicciones.</div>
      ) : !preds ? (
        <div style={{ padding: 20, textAlign: "center", fontSize: 10, color: "var(--text-dim)" }}>Cargando predicciones…</div>
      ) : visibles.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", fontSize: 10, color: "var(--text-dim)" }}>No hay predicciones {filtro !== "todas" ? `en estado "${filtro}"` : ""}.</div>
      ) : (
        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, alignItems: "start" }}>
          {visibles.map((p) => <PrediccionCard key={p.id} p={p} />)}
        </div>
      )}

      <div style={{ padding: "0 14px 10px", fontSize: 8, color: "var(--text-mute)" }}>
        Cada predicción fija su valor de entrada al publicarse y se resuelve sola contra la fuente de precios · métrica objetiva, sin autocalificación.
      </div>
    </div>
  )
}
