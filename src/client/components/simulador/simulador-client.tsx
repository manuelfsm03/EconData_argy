"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CATALOGO,
  escenarioAQueryString,
  escenarioDeQueryString,
  simular,
  type InstrumentoTipo,
  type Posicion,
  type ResultadoEscenario,
} from "@/lib/simulador/motor"

// ── Defaults sensatos si los endpoints fallan ────────────────────────────────
const DEFAULT_DOLAR_PCT = 0
const DEFAULT_IPC_PCT = 3
const DEFAULT_TPM = 35
const DEFAULT_HORIZONTE = 3

// Fallback del dólar de referencia (si /api/dolares falla)
const DOLAR_FALLBACK_ARS = 1000

// ── Utilidades de formato ────────────────────────────────────────────────────
const fmtArs = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n)

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`

// ── Cliente principal ────────────────────────────────────────────────────────
export function SimuladorClient() {
  // Sliders
  const [dolarPct, setDolarPct] = useState<number>(DEFAULT_DOLAR_PCT)
  const [ipcPct, setIpcPct] = useState<number>(DEFAULT_IPC_PCT)
  const [tpmPct, setTpmPct] = useState<number>(DEFAULT_TPM)
  const [horizonte, setHorizonte] = useState<number>(DEFAULT_HORIZONTE)

  // Dólar spot (para conversiones)
  const [dolarSpot, setDolarSpot] = useState<number>(DOLAR_FALLBACK_ARS)

  // Cartera
  const [posiciones, setPosiciones] = useState<Posicion[]>(() => carteraDefault())

  // Feedback share
  const [shareMsg, setShareMsg] = useState<string>("")
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Al montar: leer querystring y traer defaults reales ────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const parsed = escenarioDeQueryString(params)
    if (parsed.dolar != null) setDolarPct(parsed.dolar)
    if (parsed.ipc != null) setIpcPct(parsed.ipc)
    if (parsed.tpm != null) setTpmPct(parsed.tpm)
    if (parsed.horizonte != null) setHorizonte(parsed.horizonte)
    if (parsed.posiciones && parsed.posiciones.length > 0) {
      setPosiciones(
        parsed.posiciones.slice(0, 6).map((p, i) => ({
          id: `p${Date.now()}-${i}`,
          tipo: p.tipo,
          nombre: CATALOGO.find(c => c.tipo === p.tipo)?.nombre ?? p.tipo,
          monto: p.monto,
        })),
      )
    }

    // Traer defaults reales (best-effort, no bloquea)
    void hidrarDefaults({
      qsHasDolar: parsed.dolar != null,
      qsHasIpc: parsed.ipc != null,
      qsHasTpm: parsed.tpm != null,
      setDolarSpot,
      setIpcPct: (v: number) => {
        if (parsed.ipc == null) setIpcPct(v)
      },
      setTpmPct: (v: number) => {
        if (parsed.tpm == null) setTpmPct(v)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cálculo ───────────────────────────────────────────────────────────────
  const resultado: ResultadoEscenario = useMemo(
    () =>
      simular(posiciones, {
        dolarVariacionPct: dolarPct,
        inflacionMensualPct: ipcPct,
        tpmTnaPct: tpmPct,
        horizonteMeses: horizonte,
        dolarInicialArs: dolarSpot,
      }),
    [posiciones, dolarPct, ipcPct, tpmPct, horizonte, dolarSpot],
  )

  // ── Handlers cartera ──────────────────────────────────────────────────────
  function agregarPosicion(tipo: InstrumentoTipo) {
    if (posiciones.length >= 6) return
    const info = CATALOGO.find(c => c.tipo === tipo)
    if (!info) return
    setPosiciones(prev => [
      ...prev,
      {
        id: `p${Date.now()}-${prev.length}`,
        tipo,
        nombre: info.nombre,
        monto: 100_000,
      },
    ])
  }

  function eliminarPosicion(id: string) {
    setPosiciones(prev => prev.filter(p => p.id !== id))
  }

  function actualizarMonto(id: string, monto: number) {
    setPosiciones(prev =>
      prev.map(p => (p.id === id ? { ...p, monto: Number.isFinite(monto) ? Math.max(0, monto) : 0 } : p)),
    )
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  function buildShareUrl(): string {
    const qs = escenarioAQueryString({
      dolar: dolarPct,
      ipc: ipcPct,
      tpm: tpmPct,
      horizonte,
      posiciones: posiciones.map(p => ({ tipo: p.tipo, monto: p.monto })),
    })
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}/simulador`
        : "/simulador"
    return `${base}?${qs}`
  }

  function flashMsg(msg: string) {
    setShareMsg(msg)
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current)
    shareTimerRef.current = setTimeout(() => setShareMsg(""), 2500)
  }

  async function copiarLink() {
    const url = buildShareUrl()
    try {
      await navigator.clipboard.writeText(url)
      flashMsg("Link copiado")
    } catch {
      flashMsg("No se pudo copiar — copialo manualmente")
    }
  }

  function abrirWhatsapp() {
    const url = buildShareUrl()
    const ganador = resultado.ganador
    const texto = ganador
      ? `Mirá lo que pasa si el dólar hace ${fmtPct(dolarPct)}, IPC ${ipcPct}%/mes y TPM ${tpmPct}%: gana ${ganador.nombre} con ${fmtPct(ganador.retornoRealPct)} real. ${url}`
      : `Simulá vos: ${url}`
    const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(wa, "_blank", "noopener,noreferrer")
  }

  const maxRetorno = Math.max(1, ...resultado.ranking.map(r => Math.abs(r.retornoRealPct)))

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        padding: "24px clamp(16px, 4vw, 48px)",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{ maxWidth: 1280, margin: "0 auto 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/"
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              textDecoration: "none",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            ← La Pizarra
          </a>
        </div>
        <h1
          style={{
            fontSize: "clamp(22px, 3vw, 32px)",
            fontWeight: 700,
            marginTop: 8,
            lineHeight: 1.2,
            color: "var(--text)",
          }}
        >
          Simulador de escenarios — ¿qué pasa con tu plata si…?
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6, maxWidth: 780 }}>
          Movés los sliders (dólar, inflación, tasa BCRA) y armás tu cartera. El motor te dice
          qué instrumento gana el escenario. <strong>Simulación didáctica — no es
          asesoramiento financiero.</strong>
        </p>
      </header>

      {/* ── Layout principal: sliders + cartera ─────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
          gap: 20,
          maxWidth: 1280,
          margin: "0 auto",
        }}
        className="simulador-grid"
      >
        <PanelSliders
          dolarPct={dolarPct}
          setDolarPct={setDolarPct}
          ipcPct={ipcPct}
          setIpcPct={setIpcPct}
          tpmPct={tpmPct}
          setTpmPct={setTpmPct}
          horizonte={horizonte}
          setHorizonte={setHorizonte}
          dolarSpot={dolarSpot}
        />

        <PanelCartera
          posiciones={posiciones}
          onEliminar={eliminarPosicion}
          onActualizarMonto={actualizarMonto}
          onAgregar={agregarPosicion}
        />
      </div>

      {/* ── Resumen ─────────────────────────────────────────────────────── */}
      <ResumenCard
        resultado={resultado}
        horizonte={horizonte}
        dolarPct={dolarPct}
        ipcPct={ipcPct}
        tpmPct={tpmPct}
      />

      {/* ── Tabla + gráfico ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 20,
          maxWidth: 1280,
          margin: "20px auto 0",
        }}
        className="simulador-grid"
      >
        <TablaResultados resultado={resultado} />
        <GraficoRanking resultado={resultado} maxRetorno={maxRetorno} />
      </div>

      {/* ── Share ───────────────────────────────────────────────────────── */}
      <ShareBar
        onCopy={copiarLink}
        onWhatsapp={abrirWhatsapp}
        msg={shareMsg}
        shareUrl={buildShareUrl()}
      />

      <footer
        style={{
          maxWidth: 1280,
          margin: "24px auto 0",
          padding: "16px 0",
          borderTop: "1px solid var(--border)",
          fontSize: 11,
          color: "var(--text-mute)",
          lineHeight: 1.6,
        }}
      >
        <p>
          <strong>Fórmulas simplificadas:</strong> tasas TNA convertidas a mensual dividiendo por 12
          (no efectiva anual). Los spreads e ilustraciones de rendimiento son didácticos, no
          reflejan curvas de mercado ni correlaciones. No modelamos default, iliquidez ni riesgo
          soberano. Los datos macro de partida (TPM, IPC, dólar) se traen de las APIs de La Pizarra
          si están disponibles; si fallan, se usan defaults sensatos.
        </p>
      </footer>

      {/* CSS mobile */}
      <style jsx>{`
        @media (max-width: 900px) {
          :global(.simulador-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Panel de sliders ────────────────────────────────────────────────────────
function PanelSliders(props: {
  dolarPct: number
  setDolarPct: (v: number) => void
  ipcPct: number
  setIpcPct: (v: number) => void
  tpmPct: number
  setTpmPct: (v: number) => void
  horizonte: number
  setHorizonte: (v: number) => void
  dolarSpot: number
}) {
  return (
    <section className="bbg-panel" style={{ padding: 0 }}>
      <div className="bbg-panel-header">
        <span>ESCENARIO</span>
        <span style={{ fontSize: 10, color: "var(--text-mute)", marginLeft: "auto" }}>
          Dólar spot: {fmtArs(props.dolarSpot)}
        </span>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        <SliderRow
          label="Dólar (MEP/CCL): variación en el horizonte"
          help="Cuánto sube (o baja) el dólar durante el período de simulación. Ej: +20% significa que el dólar termina 20% más caro."
          value={props.dolarPct}
          onChange={props.setDolarPct}
          min={-30}
          max={50}
          step={1}
          suffix="%"
        />
        <SliderRow
          label="Inflación mensual (IPC MoM)"
          help="Ritmo mensual de suba de precios. 5% mensual = ~80% anual capitalizado."
          value={props.ipcPct}
          onChange={props.setIpcPct}
          min={0}
          max={20}
          step={0.1}
          suffix="%"
        />
        <SliderRow
          label="Tasa BCRA (TPM, TNA)"
          help="Tasa de política monetaria del BCRA en términos anuales nominales. Es la referencia del sistema financiero."
          value={props.tpmPct}
          onChange={props.setTpmPct}
          min={20}
          max={200}
          step={1}
          suffix="%"
        />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Horizonte de simulación
            </label>
            <InfoBadge text="Durante cuánto tiempo mantenés las posiciones. A más plazo, más pesa la inflación y las tasas." />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 3, 6, 12].map(m => (
              <button
                key={m}
                onClick={() => props.setHorizonte(m)}
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  background:
                    props.horizonte === m ? "var(--amber-soft)" : "transparent",
                  border: `1px solid ${props.horizonte === m ? "var(--amber)" : "var(--border)"}`,
                  color: props.horizonte === m ? "var(--amber)" : "var(--text-dim)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-data)",
                }}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SliderRow(props: {
  label: string
  help: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  suffix: string
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {props.label}
          </label>
          <InfoBadge text={props.help} />
        </div>
        <input
          type="number"
          value={props.value}
          onChange={e => props.onChange(Number(e.target.value))}
          min={props.min}
          max={props.max}
          step={props.step}
          style={{
            width: 90,
            padding: "4px 8px",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--amber)",
            background: "var(--bg-elev-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontFamily: "var(--font-data)",
            textAlign: "right",
          }}
        />
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={e => props.onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--amber)" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "var(--text-mute)",
          fontFamily: "var(--font-data)",
        }}
      >
        <span>
          {props.min}
          {props.suffix}
        </span>
        <span>
          {props.max}
          {props.suffix}
        </span>
      </div>
    </div>
  )
}

// ── Info badge ──────────────────────────────────────────────────────────────
function InfoBadge({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "1px solid var(--border-hi)",
        color: "var(--text-mute)",
        fontSize: 9,
        fontFamily: "monospace",
        fontWeight: 700,
        cursor: "help",
        userSelect: "none",
      }}
    >
      ?
    </span>
  )
}

// ── Panel Cartera ──────────────────────────────────────────────────────────
function PanelCartera(props: {
  posiciones: Posicion[]
  onEliminar: (id: string) => void
  onActualizarMonto: (id: string, monto: number) => void
  onAgregar: (tipo: InstrumentoTipo) => void
}) {
  const [tipoSeleccionado, setTipoSeleccionado] = useState<InstrumentoTipo>(
    CATALOGO[0].tipo,
  )
  const infoSeleccionada = CATALOGO.find(c => c.tipo === tipoSeleccionado)
  const puedeAgregar = props.posiciones.length < 6

  return (
    <section className="bbg-panel" style={{ padding: 0 }}>
      <div className="bbg-panel-header">
        <span>TU CARTERA</span>
        <span style={{ fontSize: 10, color: "var(--text-mute)", marginLeft: "auto" }}>
          {props.posiciones.length} / 6 posiciones
        </span>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {props.posiciones.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-mute)",
              fontSize: 12,
              border: "1px dashed var(--border)",
              borderRadius: 6,
            }}
          >
            Todavía no tenés posiciones. Agregá una abajo.
          </div>
        )}

        {props.posiciones.map(p => {
          const info = CATALOGO.find(c => c.tipo === p.tipo)
          return (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "8px minmax(0, 1fr) 140px 28px",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                background: "var(--bg-elev-2)",
                borderRadius: 6,
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 4,
                  height: "60%",
                  background: info?.colorHint ?? "var(--amber)",
                  borderRadius: 2,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.nombre}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-mute)",
                    marginTop: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {info?.descripcion}
                </div>
              </div>
              <input
                type="number"
                value={p.monto}
                onChange={e => props.onActualizarMonto(p.id, Number(e.target.value))}
                min={0}
                step={10_000}
                style={{
                  padding: "6px 8px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text)",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontFamily: "var(--font-data)",
                  textAlign: "right",
                  width: "100%",
                }}
              />
              <button
                onClick={() => props.onEliminar(p.id)}
                title="Eliminar"
                style={{
                  width: 24,
                  height: 24,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-mute)",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          )
        })}

        {puedeAgregar && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              border: "1px dashed var(--border)",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--text-mute)",
                letterSpacing: 1,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Agregar instrumento
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={tipoSeleccionado}
                onChange={e => setTipoSeleccionado(e.target.value as InstrumentoTipo)}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  background: "var(--bg-elev-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                {CATALOGO.map(c => (
                  <option key={c.tipo} value={c.tipo}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button
                onClick={() => props.onAgregar(tipoSeleccionado)}
                style={{
                  padding: "8px 14px",
                  background: "var(--amber-soft)",
                  border: "1px solid var(--amber)",
                  color: "var(--amber)",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >
                + Agregar
              </button>
            </div>
            {infoSeleccionada && (
              <div style={{ fontSize: 10, color: "var(--text-mute)", lineHeight: 1.4 }}>
                {infoSeleccionada.descripcion}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Resumen ────────────────────────────────────────────────────────────────
function ResumenCard(props: {
  resultado: ResultadoEscenario
  horizonte: number
  dolarPct: number
  ipcPct: number
  tpmPct: number
}) {
  const { resultado } = props
  if (resultado.posiciones.length === 0) return null

  const ganador = resultado.ganador
  const totalReal = resultado.totalRetornoRealPct
  const color = totalReal >= 0 ? "var(--positive)" : "var(--negative)"

  return (
    <section
      className="bbg-panel"
      style={{
        maxWidth: 1280,
        margin: "20px auto 0",
        padding: 0,
      }}
    >
      <div className="bbg-panel-header">
        <span>RESUMEN DEL ESCENARIO</span>
      </div>
      <div
        style={{
          padding: 20,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 20,
        }}
      >
        <ResumenItem label="Inflación acumulada" value={fmtPct(resultado.inflacionAcumuladaPct)} />
        <ResumenItem label="Dólar final" value={fmtArs(resultado.dolarFinalArs)} />
        <ResumenItem label="Cartera final (ARS)" value={fmtArs(resultado.totalFinalArs)} />
        <ResumenItem label="Cartera final (USD)" value={fmtUsd(resultado.totalFinalUsd)} />
        <ResumenItem
          label="Retorno real total"
          value={fmtPct(totalReal)}
          color={color}
        />
        {ganador && (
          <div
            style={{
              gridColumn: "1 / -1",
              padding: "12px 16px",
              background: "var(--amber-soft)",
              border: "1px solid var(--amber)",
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text)",
            }}
          >
            En el escenario que armaste (dólar {fmtPct(props.dolarPct)}, IPC{" "}
            {props.ipcPct}% MoM, TPM {props.tpmPct}%, horizonte {props.horizonte}m),{" "}
            la <strong>mejor jugada</strong> era{" "}
            <strong style={{ color: "var(--amber)" }}>{ganador.nombre}</strong> con{" "}
            <strong style={{ color: ganador.retornoRealPct >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {fmtPct(ganador.retornoRealPct)} real
            </strong>
            .
          </div>
        )}
      </div>
    </section>
  )
}

function ResumenItem({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-mute)",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: color ?? "var(--text)",
          fontFamily: "var(--font-data)",
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ── Tabla de resultados ────────────────────────────────────────────────────
function TablaResultados({ resultado }: { resultado: ResultadoEscenario }) {
  return (
    <section className="bbg-panel" style={{ padding: 0 }}>
      <div className="bbg-panel-header">
        <span>DETALLE POR POSICIÓN</span>
      </div>
      <div style={{ padding: 0, overflowX: "auto" }}>
        {resultado.posiciones.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--text-mute)",
              fontSize: 12,
            }}
          >
            Agregá al menos una posición para ver resultados.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Instrumento</th>
                <th className="num">Inicial (ARS)</th>
                <th className="num">Final (ARS)</th>
                <th className="num">Final (USD)</th>
                <th className="num">Retorno real</th>
              </tr>
            </thead>
            <tbody>
              {resultado.ranking.map(r => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{r.nombre}</span>
                  </td>
                  <td className="num">{fmtArs(r.valorInicialArs)}</td>
                  <td className="num">{fmtArs(r.valorFinalArs)}</td>
                  <td className="num">{fmtUsd(r.valorFinalUsd)}</td>
                  <td
                    className="num"
                    style={{
                      color: r.retornoRealPct >= 0 ? "var(--positive)" : "var(--negative)",
                      fontWeight: 700,
                    }}
                  >
                    {fmtPct(r.retornoRealPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

// ── Gráfico horizontal simple (SVG, sin recharts) ──────────────────────────
function GraficoRanking({
  resultado,
  maxRetorno,
}: {
  resultado: ResultadoEscenario
  maxRetorno: number
}) {
  return (
    <section className="bbg-panel" style={{ padding: 0 }}>
      <div className="bbg-panel-header">
        <span>RANKING (RETORNO REAL)</span>
      </div>
      <div style={{ padding: 16 }}>
        {resultado.ranking.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: "var(--text-mute)",
              fontSize: 12,
            }}
          >
            Sin posiciones.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resultado.ranking.map(r => {
              const positivo = r.retornoRealPct >= 0
              const anchoPct = Math.min(
                100,
                (Math.abs(r.retornoRealPct) / maxRetorno) * 50,
              )
              const info = CATALOGO.find(c => c.tipo === r.tipo)
              return (
                <div key={r.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{r.nombre}</span>
                    <span
                      style={{
                        color: positivo ? "var(--positive)" : "var(--negative)",
                        fontWeight: 700,
                        fontFamily: "var(--font-data)",
                      }}
                    >
                      {fmtPct(r.retornoRealPct)}
                    </span>
                  </div>
                  {/* Barra centrada: 0% en el medio */}
                  <div
                    style={{
                      position: "relative",
                      height: 10,
                      background: "var(--bg-elev-2)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    {/* Línea del cero */}
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "var(--border-hi)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        [positivo ? "left" : "right"]: "50%",
                        width: `${anchoPct}%`,
                        background: positivo
                          ? info?.colorHint ?? "var(--positive)"
                          : "var(--negative)",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Share bar ──────────────────────────────────────────────────────────────
function ShareBar(props: {
  onCopy: () => void
  onWhatsapp: () => void
  msg: string
  shareUrl: string
}) {
  const ogUrl = props.shareUrl.replace("/simulador?", "/simulador/og?")
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: "20px auto 0",
        padding: 16,
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Compartir escenario
      </span>
      <button
        onClick={props.onCopy}
        style={{
          padding: "8px 14px",
          background: "var(--amber-soft)",
          border: "1px solid var(--amber)",
          color: "var(--amber)",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: 0.5,
        }}
      >
        Copiar link
      </button>
      <button
        onClick={props.onWhatsapp}
        style={{
          padding: "8px 14px",
          background: "transparent",
          border: "1px solid var(--border-hi)",
          color: "var(--text)",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: 0.5,
        }}
      >
        WhatsApp
      </button>
      <a
        href={ogUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: "8px 14px",
          background: "transparent",
          border: "1px solid var(--border-hi)",
          color: "var(--text)",
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          textDecoration: "none",
          letterSpacing: 0.5,
        }}
      >
        Ver imagen PNG
      </a>
      {props.msg && (
        <span style={{ fontSize: 11, color: "var(--positive)" }}>{props.msg}</span>
      )}
    </section>
  )
}

// ── Cartera default ────────────────────────────────────────────────────────
function carteraDefault(): Posicion[] {
  return [
    {
      id: `p-init-1`,
      tipo: "PF_TRADICIONAL",
      nombre: "Plazo fijo tradicional",
      monto: 500_000,
    },
    {
      id: `p-init-2`,
      tipo: "DOLAR_MEP",
      nombre: "Dólar MEP",
      monto: 500_000,
    },
    {
      id: `p-init-3`,
      tipo: "PF_UVA",
      nombre: "Plazo fijo UVA",
      monto: 500_000,
    },
  ]
}

// ── Hidratación de defaults (best-effort desde APIs propias) ───────────────
async function hidrarDefaults(opts: {
  qsHasDolar: boolean
  qsHasIpc: boolean
  qsHasTpm: boolean
  setDolarSpot: (v: number) => void
  setIpcPct: (v: number) => void
  setTpmPct: (v: number) => void
}) {
  // Dólares
  try {
    const r = await fetch("/api/dolares", { cache: "no-store" })
    if (r.ok) {
      const data = await r.json()
      // El endpoint suele devolver un array de dolares con casa/venta.
      const arr = Array.isArray(data) ? data : (data as { dolares?: unknown[] }).dolares
      if (Array.isArray(arr)) {
        const mep = arr.find(
          d =>
            typeof d === "object" &&
            d !== null &&
            /(bolsa|mep)/i.test(String((d as { casa?: string; nombre?: string }).casa ?? (d as { nombre?: string }).nombre ?? "")),
        ) as { venta?: number } | undefined
        const val = typeof mep?.venta === "number" ? mep.venta : null
        if (val && val > 0) opts.setDolarSpot(val)
      }
    }
  } catch {
    /* usa fallback */
  }

  // TPM
  try {
    const r = await fetch("/api/bcra?endpoint=plazofijo", { cache: "no-store" })
    if (r.ok) {
      const data = (await r.json()) as {
        data?: { tpm?: { fecha: string; valor: number }[] }
      }
      const tpmSeries = data?.data?.tpm ?? []
      const last = tpmSeries[tpmSeries.length - 1]
      if (last && typeof last.valor === "number" && last.valor > 0) {
        opts.setTpmPct(Math.round(last.valor))
      }
    }
  } catch {
    /* usa fallback */
  }

  // IPC (última variación mensual)
  try {
    const r = await fetch("/api/macro?endpoint=ipc", { cache: "no-store" })
    if (r.ok) {
      const data = await r.json()
      const serie = extraerSerieIpc(data)
      const ultimo = serie[serie.length - 1]
      if (ultimo != null && ultimo > 0 && ultimo < 30) {
        opts.setIpcPct(Number(ultimo.toFixed(1)))
      }
    }
  } catch {
    /* usa fallback */
  }
}

function extraerSerieIpc(data: unknown): number[] {
  if (!data || typeof data !== "object") return []
  const raw = (data as { data?: unknown }).data ?? data
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (!item || typeof item !== "object") return null
        const obj = item as Record<string, unknown>
        const v =
          (typeof obj.mensual === "number" && obj.mensual) ||
          (typeof obj.variacion === "number" && obj.variacion) ||
          (typeof obj.valor === "number" && obj.valor) ||
          null
        return typeof v === "number" ? v : null
      })
      .filter((v): v is number => v != null)
  }
  return []
}
