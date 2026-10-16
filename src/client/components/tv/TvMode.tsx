"use client"

/**
 * TvMode — Vista fullscreen de datos en vivo
 *
 * Pensada para dejar corriendo en pantallas de sala de trading u oficina.
 * 4 slides que rotan cada 10 segundos. Datos se refrescan cada 2 minutos.
 *
 * Endpoints consumidos:
 *   - /api/dolares        → Tipos de cambio
 *   - /api/bcra?endpoint=reservas  → Reservas BCRA
 *   - /api/bcra?endpoint=tasas     → Tasas de referencia (TAMAR / BADLAR)
 *   - /api/riesgo-pais    → Riesgo País EMBI+ y US 10Y
 *   - /api/bonos          → Precio / TIR / variación diaria de GD30 y AL30
 *   - /api/macro?endpoint=ipc      → Precios (IPC)
 */

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface DolarRate {
  compra: number
  venta: number
  nombre: string
  variacion: number | null
}

interface DolarData {
  rates: Record<string, DolarRate>
  spreads: Record<string, number | null>
}

interface BcraReservas {
  data: {
    ultima: {
      brutas: number | null
      netas: number | null
      fecha: string | null
    }
  }
}

interface BcraTasas {
  data: {
    tamar: Array<{ fecha: string; valor: number }>
    badlar: Array<{ fecha: string; valor: number }>
  }
}

interface RiesgoPais {
  data: {
    actual: {
      riesgoPaisBps: number | null
      var1w: number | null
      gd30Precio: number | null
      arTir: number | null
      us10y: number
    }
    globalesTir: Array<{ ticker: string; tir: number | null; precio: number | null }>
  }
}

interface BonoRow {
  ticker: string
  precio: number | null
  tir: number | null
  change1D: number | null
}

interface BonosData {
  data: BonoRow[]
}

interface MacroIpc {
  data: {
    ipc_var_mensual: [string, number][]    // proporción (0.0288 = 2.88%)
    ipc_var_interanual: [string, number][] // ya en % (272.1)
    ipc_nucleo: [string, number][]         // nivel índice, sorted desc
    ipc_alimentos: [string, number][]      // nivel índice, sorted desc
  }
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SLIDES = ["cambio", "bcra", "deuda", "macro"] as const
type Slide = typeof SLIDES[number]

const SLIDE_TITLES: Record<Slide, string> = {
  cambio: "TIPOS DE CAMBIO",
  bcra: "BANCO CENTRAL",
  deuda: "DEUDA SOBERANA",
  macro: "PRECIOS",
}

const ROTATE_MS = 10_000
const REFRESH_MS = 2 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, dec = 0): string {
  if (v == null) return "—"
  return v.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function fmtPct(v: number | null | undefined, dec = 1): string {
  if (v == null) return "—"
  return (v >= 0 ? "+" : "") + v.toFixed(dec) + "%"
}

function dirColor(v: number | null | undefined, invert = false): string {
  if (v == null) return "var(--text-mute)"
  const positive = invert ? v < 0 : v >= 0
  return positive ? "var(--positive)" : "var(--negative)"
}

function lastOf<T>(arr: T[] | null | undefined): T | null {
  if (!arr || arr.length === 0) return null
  return arr[arr.length - 1]
}

// Variación mensual desde serie de niveles ordenada descendente
function varMensualDesdeNivel(serie: [string, number][] | null | undefined): number | null {
  if (!serie || serie.length < 2) return null
  const curr = serie[0][1]
  const prev = serie[1][1]
  if (!curr || !prev) return null
  return ((curr / prev) - 1) * 100
}

// ── Componente Metric card ────────────────────────────────────────────────────

interface MetricProps {
  label: string
  value: string
  sub?: string
  subColor?: string
  note?: string
  accent?: string
}

function Metric({ label, value, sub, subColor, note, accent }: MetricProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "clamp(16px, 2.5vw, 40px) clamp(20px, 3vw, 48px)",
      background: "var(--bg-elev)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      gap: "10px",
      position: "relative",
      overflow: "hidden",
      userSelect: "none",
    }}>
      {/* Barra de color en el borde superior */}
      {accent && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "3px",
          background: accent,
          borderRadius: "12px 12px 0 0",
        }} />
      )}

      {/* Label */}
      <span style={{
        fontFamily: "var(--font-data)",
        fontSize: "clamp(9px, 0.95vw, 12px)",
        letterSpacing: "0.18em",
        color: "var(--text-mute)",
        textTransform: "uppercase",
      }}>
        {label}
      </span>

      {/* Valor principal */}
      <span style={{
        fontFamily: "var(--font-data)",
        fontSize: "clamp(28px, 4.5vw, 72px)",
        fontWeight: 600,
        color: "var(--text)",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}>
        {value}
      </span>

      {/* Subvalor (variación, estado) */}
      {sub && (
        <span style={{
          fontFamily: "var(--font-data)",
          fontSize: "clamp(13px, 1.6vw, 22px)",
          fontWeight: 500,
          color: subColor ?? "var(--text-dim)",
          lineHeight: 1,
        }}>
          {sub}
        </span>
      )}

      {/* Nota al pie */}
      {note && (
        <span style={{
          fontFamily: "var(--font-data)",
          fontSize: "clamp(8px, 0.8vw, 11px)",
          color: "var(--text-mute)",
          marginTop: "4px",
        }}>
          {note}
        </span>
      )}
    </div>
  )
}

// ── Slide 1: Tipos de cambio ──────────────────────────────────────────────────

function SlideCambio({ data }: { data: DolarData | null }) {
  const rates = data?.rates
  const spreads = data?.spreads

  const oficial = rates?.oficial
  const mep = rates?.bolsa
  const blue = rates?.blue
  const ccl = rates?.contadoconliqui

  return (
    <>
      <Metric
        label="Oficial"
        value={oficial ? `$${fmtNum(oficial.venta)}` : "—"}
        sub={fmtPct(oficial?.variacion)}
        subColor={dirColor(oficial?.variacion)}
        note="Tipo de cambio minorista · BNA"
        accent="var(--sky)"
      />
      <Metric
        label="MEP / Bolsa"
        value={mep ? `$${fmtNum(mep.venta)}` : "—"}
        sub={fmtPct(mep?.variacion)}
        subColor={dirColor(mep?.variacion)}
        note={
          spreads?.brechaMepOficial != null
            ? `Brecha vs oficial: ${fmtPct(spreads.brechaMepOficial)}`
            : undefined
        }
        accent="var(--amber)"
      />
      <Metric
        label="Blue"
        value={blue ? `$${fmtNum(blue.venta)}` : "—"}
        sub={fmtPct(blue?.variacion)}
        subColor={dirColor(blue?.variacion)}
        note={
          spreads?.brechaBlueOficial != null
            ? `Brecha vs oficial: ${fmtPct(spreads.brechaBlueOficial)}`
            : undefined
        }
        accent="var(--negative)"
      />
      <Metric
        label="CCL"
        value={ccl ? `$${fmtNum(ccl.venta)}` : "—"}
        sub={fmtPct(ccl?.variacion)}
        subColor={dirColor(ccl?.variacion)}
        note={
          spreads?.brechaCclOficial != null
            ? `Brecha vs oficial: ${fmtPct(spreads.brechaCclOficial)}`
            : undefined
        }
        accent="var(--positive)"
      />
    </>
  )
}

// ── Slide 2: BCRA ─────────────────────────────────────────────────────────────

function SlideBCRA({
  reservas,
  tasas,
}: {
  reservas: BcraReservas | null
  tasas: BcraTasas | null
}) {
  const ultima = reservas?.data?.ultima
  const tamarLast = lastOf(tasas?.data?.tamar)
  const badlarLast = lastOf(tasas?.data?.badlar)

  // La API devuelve millones de USD; se muestran en miles de millones
  const brutasBn = ultima?.brutas != null ? ultima.brutas / 1000 : null
  const netasBn = ultima?.netas != null ? ultima.netas / 1000 : null

  return (
    <>
      <Metric
        label="Reservas Brutas"
        value={brutasBn != null ? `USD ${fmtNum(brutasBn, 1)}B` : "—"}
        note={ultima?.fecha ? `Al ${ultima.fecha}` : undefined}
        accent="var(--sky)"
      />
      <Metric
        label="Reservas Netas"
        value={
          netasBn != null
            ? `USD ${fmtNum(netasBn, 1)}B`
            : "—"
        }
        sub={
          ultima?.netas != null
            ? ultima.netas >= 0
              ? "Positivas"
              : "Negativas"
            : undefined
        }
        subColor={
          ultima?.netas != null
            ? ultima.netas >= 0
              ? "var(--positive)"
              : "var(--negative)"
            : undefined
        }
        note="Metodología F. Machado"
        accent={
          ultima?.netas != null
            ? ultima.netas >= 0
              ? "var(--positive)"
              : "var(--negative)"
            : "var(--border)"
        }
      />
      <Metric
        label="TAMAR (TNA)"
        value={tamarLast ? `${fmtNum(tamarLast.valor, 1)}%` : "—"}
        note={tamarLast?.fecha ? `Al ${tamarLast.fecha}` : "Bancos privados"}
        accent="var(--amber)"
      />
      <Metric
        label="BADLAR (TNA)"
        value={badlarLast ? `${fmtNum(badlarLast.valor, 1)}%` : "—"}
        note={badlarLast?.fecha ? `Al ${badlarLast.fecha}` : "Bancos privados"}
        accent="var(--yellow)"
      />
    </>
  )
}

// ── Slide 3: Deuda soberana ───────────────────────────────────────────────────

function SlideDeuda({ data, bonos }: { data: RiesgoPais | null; bonos: BonosData | null }) {
  const actual = data?.data?.actual
  const filas = Array.isArray(bonos?.data) ? bonos.data : []

  // GD30 y AL30 salen del screener de /api/bonos (mismo motor verificado)
  const gd30 = filas.find((b) => b.ticker === "GD30")
  const al30 = filas.find((b) => b.ticker === "AL30")

  // Color del riesgo país por nivel
  const rpBps = actual?.riesgoPaisBps
  const rpAccent =
    rpBps == null
      ? "var(--border)"
      : rpBps > 2000
      ? "var(--negative)"
      : rpBps > 1000
      ? "var(--amber)"
      : rpBps > 500
      ? "var(--yellow)"
      : "var(--positive)"

  return (
    <>
      <Metric
        label="Riesgo País EMBI+"
        value={rpBps != null ? `${fmtNum(rpBps)} bps` : "—"}
        sub={
          actual?.var1w != null
            ? `${actual.var1w > 0 ? "+" : ""}${fmtNum(actual.var1w)} bps (7d)`
            : undefined
        }
        // Baja en bps = mejora → color invertido
        subColor={dirColor(actual?.var1w != null ? -actual.var1w : null)}
        note="EMBI+ Argentina · argentinadatos.com"
        accent={rpAccent}
      />
      <Metric
        label="GD30 Precio"
        value={
          gd30?.precio != null
            ? `USD ${fmtNum(gd30.precio, 2)}`
            : actual?.gd30Precio != null
            ? `USD ${fmtNum(actual.gd30Precio, 2)}`
            : "—"
        }
        sub={
          gd30?.change1D != null
            ? `${fmtPct(gd30.change1D, 2)} (1d)`
            : undefined
        }
        subColor={dirColor(gd30?.change1D)}
        note={
          gd30?.tir != null
            ? `TIR ${fmtNum(gd30.tir, 2)}% · Global USD Ley NY 2030`
            : actual?.arTir != null
            ? `TIR ${fmtNum(actual.arTir, 2)}% · Global USD Ley NY 2030`
            : "Global USD Ley NY 2030"
        }
        accent="var(--sky)"
      />
      <Metric
        label="AL30 Precio"
        value={al30?.precio != null ? `USD ${fmtNum(al30.precio, 2)}` : "—"}
        sub={al30?.change1D != null ? `${fmtPct(al30.change1D, 2)} (1d)` : undefined}
        subColor={dirColor(al30?.change1D)}
        note={
          al30?.tir != null
            ? `TIR ${fmtNum(al30.tir, 2)}% · Bonar USD Ley Argentina 2030`
            : "Bonar USD Ley Argentina 2030"
        }
        accent="var(--amber)"
      />
      <Metric
        label="US 10Y Treasury"
        value={actual?.us10y != null ? `${fmtNum(actual.us10y, 2)}%` : "—"}
        note="Referencia libre de riesgo · Yahoo Finance / FRED"
        accent="var(--text-mute)"
      />
    </>
  )
}

// ── Slide 4: Precios (IPC) ────────────────────────────────────────────────────

function SlideMacro({ data }: { data: MacroIpc | null }) {
  // ipc_var_mensual: proporción (0.0288 = 2.88%), sorted desc → [0] es el más reciente
  const ipcMensRow = data?.data?.ipc_var_mensual?.[0]
  const varMens = ipcMensRow ? ipcMensRow[1] * 100 : null

  // ipc_var_interanual: ya en % (e.g. 272.1), sorted desc
  const ipcIARow = data?.data?.ipc_var_interanual?.[0]
  const varIA = ipcIARow ? ipcIARow[1] : null

  // ipc_nucleo: nivel índice, var mensual calculada desde niveles consecutivos
  const varNucleo = varMensualDesdeNivel(data?.data?.ipc_nucleo)
  const nucleoDate = data?.data?.ipc_nucleo?.[0]?.[0]

  // ipc_alimentos: nivel índice, var mensual calculada
  const varAlimentos = varMensualDesdeNivel(data?.data?.ipc_alimentos)

  const periodo = ipcMensRow?.[0] ?? nucleoDate ?? null

  return (
    <>
      <Metric
        label="IPC — Var. Mensual"
        value={varMens != null ? `${varMens.toFixed(1)}%` : "—"}
        sub={periodo ? `Período: ${periodo}` : undefined}
        note="Índice Precios Consumidor Nacional · INDEC"
        accent="var(--negative)"
      />
      <Metric
        label="IPC — Var. Interanual"
        value={varIA != null ? `${fmtNum(varIA, 1)}%` : "—"}
        note="Acumulado 12 meses"
        accent="var(--amber)"
      />
      <Metric
        label="IPC Núcleo — Var. Mensual"
        value={varNucleo != null ? `${varNucleo.toFixed(1)}%` : "—"}
        note="Excluye estacionales y regulados"
        accent="var(--yellow)"
      />
      <Metric
        label="Alimentos y bebidas — Var. Mensual"
        value={varAlimentos != null ? `${varAlimentos.toFixed(1)}%` : "—"}
        note="Alimentos y bebidas no alcohólicas · INDEC"
        accent="var(--sky)"
      />
    </>
  )
}

// ── Barra inferior ────────────────────────────────────────────────────────────

function BottomBar({
  now,
  lastUpdate,
  loading,
  onExit,
}: {
  now: Date | null
  lastUpdate: Date | null
  loading: boolean
  onExit: () => void
}) {
  const clock = now
    ? now.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--"

  const lastStr = lastUpdate
    ? lastUpdate.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "24px",
      padding: "0 clamp(16px, 3vw, 48px)",
      height: "44px",
      background: "var(--bg-elev)",
      borderTop: "1px solid var(--border)",
      fontFamily: "var(--font-data)",
      fontSize: "11px",
      color: "var(--text-mute)",
      flexShrink: 0,
      letterSpacing: "0.06em",
    }}>
      <span style={{
        color: "var(--amber)",
        fontWeight: 700,
        fontSize: "16px",
        letterSpacing: "0.04em",
        minWidth: "80px",
      }}>
        {clock}
      </span>

      <span style={{ color: "var(--border)" }}>│</span>
      <span>
        {loading ? "ACTUALIZANDO…" : `ÚLTIMO UPDATE: ${lastStr}`}
      </span>

      <div style={{ flex: 1 }} />

      <span style={{
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: "var(--text-dim)",
        fontSize: "12px",
      }}>
        LA PIZARRA
      </span>

      <span style={{ color: "var(--border)" }}>│</span>

      <button
        onClick={onExit}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          color: "var(--text-mute)",
          cursor: "pointer",
          fontSize: "10px",
          padding: "3px 10px",
          borderRadius: "4px",
          fontFamily: "var(--font-data)",
          letterSpacing: "0.1em",
          transition: "border-color 0.2s, color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--text-dim)"
          e.currentTarget.style.color = "var(--text)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)"
          e.currentTarget.style.color = "var(--text-mute)"
        }}
      >
        ESC · SALIR
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TvMode() {
  const router = useRouter()

  const [slideIdx, setSlideIdx] = useState(0)
  const [now, setNow] = useState<Date | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)

  const [dolares, setDolares] = useState<DolarData | null>(null)
  const [reservas, setReservas] = useState<BcraReservas | null>(null)
  const [tasas, setTasas] = useState<BcraTasas | null>(null)
  const [riesgoPais, setRiesgoPais] = useState<RiesgoPais | null>(null)
  const [bonos, setBonos] = useState<BonosData | null>(null)
  const [macro, setMacro] = useState<MacroIpc | null>(null)

  // Salir del modo TV
  const handleExit = useCallback(() => {
    document.exitFullscreen?.().catch(() => {})
    router.push("/")
  }, [router])

  // Entrar en fullscreen al montar
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => {
      document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  // Reloj en tiempo real
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Tecla ESC para salir
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleExit()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleExit])

  // Rotación automática de slides cada 10 segundos
  useEffect(() => {
    const t = setInterval(
      () => setSlideIdx((i) => (i + 1) % SLIDES.length),
      ROTATE_MS,
    )
    return () => clearInterval(t)
  }, [])

  // Fetch de todos los endpoints
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [d, r, t, rp, b, m] = await Promise.allSettled([
      fetch("/api/dolares").then((res) => res.json()),
      fetch("/api/bcra?endpoint=reservas").then((res) => res.json()),
      fetch("/api/bcra?endpoint=tasas").then((res) => res.json()),
      fetch("/api/riesgo-pais").then((res) => res.json()),
      fetch("/api/bonos").then((res) => res.json()),
      fetch("/api/macro?endpoint=ipc").then((res) => res.json()),
    ])

    if (d.status === "fulfilled") setDolares(d.value)
    if (r.status === "fulfilled") setReservas(r.value)
    if (t.status === "fulfilled") setTasas(t.value)
    if (rp.status === "fulfilled") setRiesgoPais(rp.value)
    if (b.status === "fulfilled") setBonos(b.value)
    if (m.status === "fulfilled") setMacro(m.value)

    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  // Fetch inicial + polling cada 2 minutos
  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(t)
  }, [fetchAll])

  const slide = SLIDES[slideIdx]

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "0 clamp(16px, 3vw, 48px)",
        height: "52px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {/* Título del slide */}
        <span style={{
          fontFamily: "var(--font-data)",
          fontWeight: 700,
          fontSize: "clamp(13px, 1.4vw, 18px)",
          color: "var(--amber)",
          letterSpacing: "0.12em",
        }}>
          {SLIDE_TITLES[slide]}
        </span>

        <div style={{ flex: 1 }} />

        {/* Dots de navegación */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {SLIDES.map((s, i) => (
            <button
              key={s}
              title={SLIDE_TITLES[s]}
              onClick={() => setSlideIdx(i)}
              style={{
                width: i === slideIdx ? "28px" : "8px",
                height: "8px",
                borderRadius: "4px",
                background: i === slideIdx ? "var(--amber)" : "var(--border-hi)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.3s ease",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Grid 2×2 de métricas */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: "clamp(8px, 1.2vw, 20px)",
        padding: "clamp(12px, 1.8vw, 32px)",
        overflow: "hidden",
      }}>
        {slide === "cambio" && <SlideCambio data={dolares} />}
        {slide === "bcra" && <SlideBCRA reservas={reservas} tasas={tasas} />}
        {slide === "deuda" && <SlideDeuda data={riesgoPais} bonos={bonos} />}
        {slide === "macro" && <SlideMacro data={macro} />}
      </div>

      {/* Barra inferior */}
      <BottomBar
        now={now}
        lastUpdate={lastUpdate}
        loading={loading}
        onExit={handleExit}
      />
    </div>
  )
}
