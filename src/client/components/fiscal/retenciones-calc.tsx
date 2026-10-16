"use client"

/**
 * RetencionesCalc — Calculadora de retenciones agropecuarias.
 *
 * Las alícuotas se leen de /data/retenciones.json (nunca hardcodeadas aquí).
 * El precio FOB disponible se intenta obtener de /api/agro-local; si falla,
 * el usuario puede ingresarlo manualmente.
 * El dólar oficial viene de /api/dolares.
 *
 * AVISO: estimación orientativa, no reemplaza asesoramiento profesional.
 */

import { useEffect, useState, useCallback } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CultivoRetenciones {
  derecho_export: number   // fracción decimal (0.33 = 33%)
  descripcion: string
}

// Esquema de public/data/retenciones.json (ver retenciones.README.md)
interface RetencionesData {
  cultivos: Record<string, CultivoRetenciones>
  fuente: string
  vigente_desde?: string
}

// Nombres de display: el JSON solo trae la clave, no el nombre con tildes
const NOMBRE_CULTIVO: Record<string, string> = {
  soja: "Soja", maiz: "Maíz", trigo: "Trigo", girasol: "Girasol",
}
const nombreCultivo = (key: string) => NOMBRE_CULTIVO[key] ?? key

interface AgroLocalGrano {
  disponible: number | null
  fobOficial: number | null
  retencion: number
  unidad: string
}

interface AgroLocalData {
  soja: AgroLocalGrano
  maiz: AgroLocalGrano
  trigo: AgroLocalGrano
  girasol: AgroLocalGrano
  source: string
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Disclaimer({ texto }: { texto: string }) {
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "flex-start",
      background: "var(--amber-soft)", border: "1px solid var(--amber)",
      borderRadius: 4, padding: "8px 12px", marginBottom: 16,
    }}>
      <AlertTriangle size={14} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 11, color: "var(--amber)", lineHeight: 1.6 }}>{texto}</p>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontFamily: "var(--font-data)", textTransform: "uppercase",
      letterSpacing: "0.1em", color: "var(--text-mute)", marginBottom: 6 }}>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%", boxSizing: "border-box",
        background: "var(--bg)", border: "1px solid var(--border)",
        color: disabled ? "var(--text-mute)" : "var(--text)",
        fontFamily: "var(--font-data)", fontSize: 13,
        padding: "7px 10px", borderRadius: 4, outline: "none",
        opacity: disabled ? 0.6 : 1,
      }}
    />
  )
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "9px 14px",
      borderBottom: "1px solid var(--border-light)",
    }}>
      <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-ui)" }}>{label}</span>
      <span style={{
        fontSize: 13, fontFamily: "var(--font-data)", fontWeight: highlight ? 700 : 500,
        color: highlight ? "var(--positive)" : "var(--text)",
      }}>{value}</span>
    </div>
  )
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtUSD(n: number) {
  return `USD ${fmt(n)}`
}

function fmtARS(n: number) {
  return `ARS ${fmt(n, 0)}`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function RetencionesCalc() {
  // Datos externos
  const [retencionesData, setRetencionesData] = useState<RetencionesData | null>(null)
  const [agroData, setAgroData] = useState<AgroLocalData | null>(null)
  const [dolarOficial, setDolarOficial] = useState<number | null>(null)
  const [loadingExterno, setLoadingExterno] = useState(true)
  const [errorExterno, setErrorExterno] = useState<string | null>(null)

  // Inputs del usuario
  const [cultivoKey, setCultivoKey] = useState("soja")
  const [toneladas, setToneladas] = useState("")
  const [precioManual, setPrecioManual] = useState("")
  const [usarManual, setUsarManual] = useState(false)

  // Cargar datos
  const cargarDatos = useCallback(async () => {
    setLoadingExterno(true)
    setErrorExterno(null)
    try {
      const [retenRes, agroRes, dolarRes] = await Promise.allSettled([
        fetch("/data/retenciones.json"),
        fetch("/api/agro-local"),
        fetch("/api/dolares"),
      ])

      if (retenRes.status === "fulfilled" && retenRes.value.ok) {
        const data: RetencionesData = await retenRes.value.json()
        setRetencionesData(data)
      } else {
        throw new Error("No se pudo cargar retenciones.json")
      }

      if (agroRes.status === "fulfilled" && agroRes.value.ok) {
        const data: AgroLocalData = await agroRes.value.json()
        setAgroData(data)
      }

      if (dolarRes.status === "fulfilled" && dolarRes.value.ok) {
        const data = await dolarRes.value.json()
        const oficial = data?.rates?.oficial?.venta ?? null
        setDolarOficial(oficial)
      }
    } catch (err) {
      setErrorExterno(err instanceof Error ? err.message : "Error al cargar datos")
    } finally {
      setLoadingExterno(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // Lógica de cálculo
  const cultivo = retencionesData?.cultivos[cultivoKey] ?? null
  const precioApiMap: Record<string, number | null> = {
    soja: agroData?.soja?.disponible ?? null,
    maiz: agroData?.maiz?.disponible ?? null,
    trigo: agroData?.trigo?.disponible ?? null,
    girasol: agroData?.girasol?.disponible ?? null,
  }
  const precioApi = precioApiMap[cultivoKey] ?? null
  const precioFinal = usarManual
    ? (parseFloat(precioManual) || null)
    : (precioApi ?? (parseFloat(precioManual) || null))

  const toneladasNum = parseFloat(toneladas) || 0
  const alicuota = cultivo?.derecho_export ?? 0

  const ingresoBrutoUSD = precioFinal && toneladasNum > 0
    ? precioFinal * toneladasNum
    : null
  const retencionUSD = ingresoBrutoUSD !== null
    ? ingresoBrutoUSD * alicuota
    : null
  const ingresoNetoUSD = ingresoBrutoUSD !== null && retencionUSD !== null
    ? ingresoBrutoUSD - retencionUSD
    : null

  const retencionARS = retencionUSD !== null && dolarOficial !== null
    ? retencionUSD * dolarOficial
    : null
  const ingresoNetoARS = ingresoNetoUSD !== null && dolarOficial !== null
    ? ingresoNetoUSD * dolarOficial
    : null

  const hayResultado = ingresoBrutoUSD !== null

  // Detectar si necesita precio manual
  const necesitaManual = !precioApi || usarManual

  if (loadingExterno) {
    return (
      <div style={{ padding: "32px 24px", textAlign: "center", fontFamily: "var(--font-data)",
        color: "var(--text-mute)", fontSize: 11 }}>
        CARGANDO DATOS...
      </div>
    )
  }

  if (errorExterno || !retencionesData) {
    return (
      <div style={{ padding: "32px 24px", textAlign: "center", fontFamily: "var(--font-data)",
        color: "var(--negative)", fontSize: 11 }}>
        {errorExterno ?? "Error al cargar retenciones.json"}
      </div>
    )
  }

  const cultivos = Object.entries(retencionesData.cultivos)

  return (
    <div style={{ padding: "16px 18px 24px" }}>
      <Disclaimer texto="Estimación orientativa. No reemplaza asesoramiento profesional ni consulta a organismos oficiales (ARCA, Ministerio de Economía). Las retenciones pueden modificarse por decreto." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720 }}>
        {/* Panel de inputs */}
        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 4, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--text-dim)", marginBottom: 16 }}>
            Parámetros
          </div>

          {/* Selector de cultivo */}
          <div style={{ marginBottom: 14 }}>
            <Label>Cultivo</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {cultivos.map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => { setCultivoKey(key); setUsarManual(false) }}
                  style={{
                    padding: "5px 12px", borderRadius: 4, fontSize: 12, cursor: "pointer",
                    border: "1px solid",
                    borderColor: cultivoKey === key ? "var(--amber)" : "var(--border)",
                    background: cultivoKey === key ? "var(--amber-soft)" : "var(--bg)",
                    color: cultivoKey === key ? "var(--amber)" : "var(--text-dim)",
                    fontFamily: "var(--font-ui)", fontWeight: cultivoKey === key ? 600 : 400,
                  }}
                >
                  {nombreCultivo(key)} <span style={{ opacity: 0.7 }}>({(c.derecho_export * 100).toFixed(0)}%)</span>
                </button>
              ))}
            </div>
            {cultivo && (
              <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
                {cultivo.descripcion}
              </div>
            )}
          </div>

          {/* Toneladas */}
          <div style={{ marginBottom: 14 }}>
            <Label>Toneladas a liquidar</Label>
            <NumInput value={toneladas} onChange={setToneladas} placeholder="ej. 500" />
          </div>

          {/* Precio FOB */}
          <div style={{ marginBottom: 14 }}>
            <Label>
              Precio disponible (USD/tn)
              {precioApi && !usarManual && (
                <span style={{ marginLeft: 6, color: "var(--positive)" }}>
                  · Pizarra Rosario: {fmtUSD(precioApi)}
                </span>
              )}
            </Label>
            {precioApi && (
              <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
                <button
                  onClick={() => setUsarManual(false)}
                  style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 3, cursor: "pointer",
                    border: "1px solid",
                    borderColor: !usarManual ? "var(--positive)" : "var(--border)",
                    background: !usarManual ? "rgba(107,212,168,0.1)" : "var(--bg)",
                    color: !usarManual ? "var(--positive)" : "var(--text-mute)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  Usar pizarra
                </button>
                <button
                  onClick={() => setUsarManual(true)}
                  style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 3, cursor: "pointer",
                    border: "1px solid",
                    borderColor: usarManual ? "var(--sky)" : "var(--border)",
                    background: usarManual ? "rgba(116,169,201,0.1)" : "var(--bg)",
                    color: usarManual ? "var(--sky)" : "var(--text-mute)",
                    fontFamily: "var(--font-data)",
                  }}
                >
                  Ingresar manual
                </button>
              </div>
            )}
            <NumInput
              value={necesitaManual ? precioManual : String(precioApi ?? "")}
              onChange={necesitaManual ? setPrecioManual : () => {}}
              disabled={!necesitaManual}
              placeholder={necesitaManual ? "ej. 285" : ""}
            />
            {!precioApi && (
              <div style={{ marginTop: 5, fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
                Pizarra Rosario no disponible — ingresá el precio manualmente
              </div>
            )}
          </div>

          {/* Dólar */}
          <div style={{ marginBottom: 4 }}>
            <Label>Tipo de cambio oficial (ARS/USD)</Label>
            <div style={{ fontSize: 12, fontFamily: "var(--font-data)", color: dolarOficial ? "var(--text)" : "var(--text-mute)",
              background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "7px 10px" }}>
              {dolarOficial ? `ARS ${fmt(dolarOficial)}` : "No disponible (conversión en ARS no calculada)"}
            </div>
          </div>

          <button
            onClick={cargarDatos}
            style={{
              marginTop: 12, display: "flex", alignItems: "center", gap: 5,
              fontSize: 10, color: "var(--text-mute)", background: "none",
              border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-data)",
            }}
          >
            <RefreshCw size={10} /> Actualizar precios
          </button>
        </div>

        {/* Panel de resultados */}
        <div style={{ background: "var(--bg-elev)", border: "1px solid var(--border)", borderRadius: 4 }}>
          <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
              color: "var(--text-dim)" }}>
              Resultado
            </div>
          </div>

          {!hayResultado ? (
            <div style={{ padding: "32px 16px", textAlign: "center", fontSize: 11,
              color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
              Completá cultivo, toneladas y precio
            </div>
          ) : (
            <>
              <ResultRow label="Ingreso bruto" value={fmtUSD(ingresoBrutoUSD!)} />
              <ResultRow
                label={`Retención ${nombreCultivo(cultivoKey)} (${(alicuota * 100).toFixed(0)}%)`}
                value={`— ${fmtUSD(retencionUSD!)}`}
              />
              <ResultRow label="Ingreso neto (USD)" value={fmtUSD(ingresoNetoUSD!)} highlight />

              {dolarOficial && (
                <>
                  <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                  <ResultRow label="Retención (ARS)" value={fmtARS(retencionARS!)} />
                  <ResultRow label="Ingreso neto (ARS)" value={fmtARS(ingresoNetoARS!)} highlight />
                </>
              )}

              <div style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-data)", lineHeight: 1.6 }}>
                  Cultivo: {nombreCultivo(cultivoKey)} ·Alícuota: {(alicuota * 100).toFixed(0)}% ·
                  Precio: {precioFinal ? fmtUSD(precioFinal) + "/tn" : "—"} ·
                  Toneladas: {toneladasNum.toLocaleString("es-AR")}
                </div>
                {agroData && !usarManual && precioApi && (
                  <div style={{ fontSize: 9, color: "var(--text-mute)", fontFamily: "var(--font-data)", marginTop: 3 }}>
                    Precio: {agroData.source}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fuente */}
      <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-mute)", fontFamily: "var(--font-data)" }}>
        Tasas: {retencionesData.fuente}
        {retencionesData.vigente_desde ? ` · vigentes desde ${retencionesData.vigente_desde}` : ""}
      </div>
    </div>
  )
}
