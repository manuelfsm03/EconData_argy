"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Target, Plus } from "lucide-react"
import { MOCK_PROFILES } from "./mock-profiles"
import {
  describirCondicion,
  puntosPorPrediccion,
  validarPrediccion,
  type Prediccion,
  type PrediccionInput,
  type EstadoPrediccion,
  type TipoActivo,
  type MetricaPrediccion,
  type OperadorPrediccion,
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

// ── Formulario para publicar una predicción (POST /api/predictions) ─────────────
const TIPOS: { v: TipoActivo; label: string }[] = [
  { v: "bono", label: "Bono" }, { v: "accion", label: "Acción" }, { v: "fx", label: "FX" },
  { v: "tasa", label: "Tasa" }, { v: "indice", label: "Índice" }, { v: "cripto", label: "Cripto" },
]
const METRICAS: { v: MetricaPrediccion; label: string }[] = [
  { v: "precio", label: "Precio" }, { v: "tir", label: "TIR/TNA" }, { v: "paridad", label: "Paridad" },
  { v: "spread", label: "Spread" }, { v: "variacion_pct", label: "Variación %" },
]
const OPERADORES: { v: OperadorPrediccion; label: string }[] = [
  { v: "mayor_igual", label: "≥ objetivo" }, { v: "menor_igual", label: "≤ objetivo" },
  { v: "sube", label: "Sube vs entrada" }, { v: "baja", label: "Baja vs entrada" },
  { v: "rango", label: "En rango" },
]

const inputStyle: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4,
  color: "var(--text)", fontFamily: "var(--font-data)", fontSize: 11, padding: "5px 8px", width: "100%",
}
const labelStyle: React.CSSProperties = { fontSize: 8, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, display: "block" }

function NuevaPrediccionForm({ onCreated }: { onCreated: () => void }) {
  const [activo, setActivo] = useState("")
  const [tipoActivo, setTipoActivo] = useState<TipoActivo>("bono")
  const [tesis, setTesis] = useState("")
  const [metrica, setMetrica] = useState<MetricaPrediccion>("precio")
  const [operador, setOperador] = useState<OperadorPrediccion>("mayor_igual")
  const [objetivo, setObjetivo] = useState("")
  const [objetivoMax, setObjetivoMax] = useState("")
  const [valorEntrada, setValorEntrada] = useState("")
  const [horizonte, setHorizonte] = useState("30 días")
  const [fechaResolucion, setFechaResolucion] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)

  const requiereObjetivo = operador === "mayor_igual" || operador === "menor_igual" || operador === "rango"

  async function submit() {
    setError("")
    const input: PrediccionInput = {
      activo: activo.trim(), tipoActivo, tesis: tesis.trim(), metrica, operador,
      objetivo: requiereObjetivo && objetivo !== "" ? Number(objetivo) : null,
      objetivoMax: operador === "rango" && objetivoMax !== "" ? Number(objetivoMax) : null,
      horizonte: horizonte.trim(), fechaResolucion,
    }
    // Validación con el mismo helper del contrato (resoluble, no ambigua)
    const motivo = validarPrediccion(input)
    if (motivo) { setError(motivo); return }
    if (valorEntrada === "" || isNaN(Number(valorEntrada))) { setError("Ingresá el valor de entrada actual de la métrica"); return }

    setEnviando(true)
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, valorEntrada: Number(valorEntrada) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? "No se pudo publicar la predicción")
        return
      }
      onCreated()
    } catch {
      setError("Error de red al publicar")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ padding: "12px 14px", background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div><label style={labelStyle}>Activo (ticker)</label><input style={inputStyle} value={activo} onChange={(e) => setActivo(e.target.value.toUpperCase())} placeholder="GD30" /></div>
        <div><label style={labelStyle}>Tipo</label><select style={inputStyle} value={tipoActivo} onChange={(e) => setTipoActivo(e.target.value as TipoActivo)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
        <div><label style={labelStyle}>Métrica</label><select style={inputStyle} value={metrica} onChange={(e) => setMetrica(e.target.value as MetricaPrediccion)}>{METRICAS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></div>
      </div>

      <div><label style={labelStyle}>Tesis (tu razonamiento)</label><textarea style={{ ...inputStyle, minHeight: 46, resize: "vertical" }} value={tesis} onChange={(e) => setTesis(e.target.value)} placeholder="Por qué creés que va a pasar…" /></div>

      <div style={{ display: "grid", gridTemplateColumns: requiereObjetivo ? (operador === "rango" ? "1.2fr 0.9fr 0.9fr 1fr" : "1.4fr 1fr 1fr") : "1.6fr 1fr", gap: 8, alignItems: "end" }}>
        <div><label style={labelStyle}>Condición</label><select style={inputStyle} value={operador} onChange={(e) => setOperador(e.target.value as OperadorPrediccion)}>{OPERADORES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select></div>
        {requiereObjetivo && <div><label style={labelStyle}>{operador === "rango" ? "Mínimo" : "Objetivo"}</label><input style={inputStyle} type="number" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} /></div>}
        {operador === "rango" && <div><label style={labelStyle}>Máximo</label><input style={inputStyle} type="number" value={objetivoMax} onChange={(e) => setObjetivoMax(e.target.value)} /></div>}
        <div><label style={labelStyle}>Valor entrada (hoy)</label><input style={inputStyle} type="number" value={valorEntrada} onChange={(e) => setValorEntrada(e.target.value)} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div><label style={labelStyle}>Horizonte</label><input style={inputStyle} value={horizonte} onChange={(e) => setHorizonte(e.target.value)} placeholder="30 días / al vencimiento" /></div>
        <div><label style={labelStyle}>Fecha de resolución</label><input style={inputStyle} type="date" value={fechaResolucion} onChange={(e) => setFechaResolucion(e.target.value)} /></div>
        <button onClick={submit} disabled={enviando} style={{ border: "1px solid var(--positive)", background: "color-mix(in srgb, var(--positive) 14%, transparent)", color: "var(--positive)", cursor: enviando ? "default" : "pointer", borderRadius: 4, fontSize: 11, fontWeight: 700, padding: "7px 16px", opacity: enviando ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {enviando ? "Publicando…" : "Publicar"}
        </button>
      </div>

      {error && <span role="alert" style={{ fontSize: 10, color: "var(--negative)" }}>{error}</span>}
      <span style={{ fontSize: 8, color: "var(--text-mute)" }}>El valor de entrada queda fijo al publicar (foto inmutable). La predicción se resuelve sola contra la fuente al vencimiento.</span>
    </div>
  )
}

// ── Feed principal ─────────────────────────────────────────────────────────────
export function PredictionsFeed() {
  const [preds, setPreds] = useState<Prediccion[] | null>(null)
  const [error, setError] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [showForm, setShowForm] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/predictions?limit=48")
      const j = await r.json()
      setPreds(Array.isArray(j.data) ? j.data : [])
    } catch { setError(true) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

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
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: `1px solid ${showForm ? "var(--amber)" : "var(--positive)"}`, background: showForm ? "var(--amber-soft)" : "transparent", color: showForm ? "var(--amber)" : "var(--positive)", fontWeight: 700 }}
        >
          <Plus size={11} /> {showForm ? "Cerrar" : "Publicar tesis"}
        </button>
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

      {/* Formulario de nueva predicción */}
      {showForm && <NuevaPrediccionForm onCreated={() => { setShowForm(false); cargar() }} />}

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
